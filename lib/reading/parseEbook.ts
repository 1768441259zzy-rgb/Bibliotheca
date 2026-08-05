import JSZip from 'jszip';
import { parsePdfFile } from '@/lib/reading/parsePdf';

export interface ParsedChapter {
  title: string;
  html: string;
  text: string;
  /** EPUB 内相对路径（用于目录 / 页码跳转） */
  path?: string;
}

export interface ParsedEbook {
  title: string;
  chapters: ParsedChapter[];
  format: 'txt' | 'epub' | 'pdf';
  /** PDF 原始字节，供按页渲染 */
  pdfData?: Uint8Array;
  pageCount?: number;
}

export function resolveZipPath(base: string, relative: string): string {
  if (!relative) return base;
  const clean = relative.split('#')[0].trim();
  if (!clean) return base;
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) return clean;
  try {
    const decoded = decodeURIComponent(clean);
    if (decoded.startsWith('/')) return decoded.replace(/^\/+/, '');
    const baseParts = base.split('/').filter(Boolean);
    baseParts.pop();
    for (const part of decoded.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') baseParts.pop();
      else baseParts.push(part);
    }
    return baseParts.join('/');
  } catch {
    return clean.replace(/^\/+/, '');
  }
}

function normalizeEpubPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

/** 按 EPUB 内路径查找章节下标 */
export function findChapterIndexByPath(
  chapters: ParsedChapter[],
  resolvedPath: string
): number {
  const target = normalizeEpubPath(resolvedPath);
  if (!target) return -1;
  const exact = chapters.findIndex(
    (c) => c.path && normalizeEpubPath(c.path) === target
  );
  if (exact >= 0) return exact;

  const base = target.split('/').pop() || target;
  const hits = chapters
    .map((c, i) => ({ i, path: c.path ? normalizeEpubPath(c.path) : '' }))
    .filter(
      (c) => c.path === base || c.path.endsWith(`/${base}`)
    );
  return hits[0]?.i ?? -1;
}

function rewriteEpubLinks(html: string): string {
  return html.replace(
    /<a\b([^>]*?)\bhref\s*=\s*(["'])([^"']*)\2([^>]*)>/gi,
    (full, pre: string, quote: string, href: string, post: string) => {
      const trimmed = href.trim();
      if (!trimmed || /^(https?:|mailto:|javascript:)/i.test(trimmed)) {
        return full;
      }
      const attrs = `${pre}${post}`.replace(
        /\s*data-epub-href\s*=\s*(["'])[\s\S]*?\1/gi,
        ''
      );
      const safe = trimmed
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      return `<a${attrs} href="#" data-epub-href=${quote}${safe}${quote}>`;
    }
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeTextBuffer(buffer: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

function splitTxtChapters(raw: string, fileName: string): ParsedEbook {
  const text = raw.replace(/\r\n/g, '\n').trim();
  const parts = text.split(
    /(?=^第[零一二三四五六七八九十百千0-9]+[章节回部卷].*$|^Chapter\s+\d+.*$)/gim
  );
  const chapters =
    parts.length > 1
      ? parts
          .map((p, i) => {
            const lines = p.trim().split('\n');
            const title = lines[0]?.trim() || `段落 ${i + 1}`;
            const body = lines.slice(1).join('\n').trim() || p.trim();
            return {
              title,
              html: body
                .split(/\n{2,}/)
                .map((para) => `<p>${escapeHtml(para.trim())}</p>`)
                .join(''),
              text: body,
            };
          })
          .filter((c) => c.text.length > 0)
      : [
          {
            title: fileName.replace(/\.[^.]+$/, '') || '正文',
            html: text
              .split(/\n{2,}/)
              .map((para) => `<p>${escapeHtml(para.trim())}</p>`)
              .join(''),
            text,
          },
        ];

  return {
    title: fileName.replace(/\.[^.]+$/, '') || 'Untitled',
    chapters,
    format: 'txt',
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function parseEpub(buffer: ArrayBuffer, fileName: string): Promise<ParsedEbook> {
  const zip = await JSZip.loadAsync(buffer);
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('无效的 EPUB：缺少 container.xml');

  const rootMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
  if (!rootMatch) throw new Error('无效的 EPUB：无法定位内容清单');

  const opfPath = rootMatch[1];
  const opfXml = await zip.file(opfPath)?.async('string');
  if (!opfXml) throw new Error('无效的 EPUB：缺少 OPF 清单');

  const titleMatch =
    opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i) ||
    opfXml.match(/<title[^>]*>([^<]+)<\/title>/i);
  const bookTitle =
    titleMatch?.[1]?.trim() || fileName.replace(/\.[^.]+$/, '') || 'Untitled';

  const manifest = new Map<string, string>();
  const itemRe =
    /<item\b[^>]*id=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let item: RegExpExecArray | null;
  while ((item = itemRe.exec(opfXml))) {
    manifest.set(item[1], item[2]);
  }
  const itemRe2 =
    /<item\b[^>]*href=["']([^"']+)["'][^>]*id=["']([^"']+)["'][^>]*>/gi;
  while ((item = itemRe2.exec(opfXml))) {
    if (!manifest.has(item[2])) manifest.set(item[2], item[1]);
  }

  const spineIds: string[] = [];
  const spineRe = /<itemref\b[^>]*idref=["']([^"']+)["'][^>]*>/gi;
  let spine: RegExpExecArray | null;
  while ((spine = spineRe.exec(opfXml))) {
    spineIds.push(spine[1]);
  }

  const chapters: ParsedEbook['chapters'] = [];

  for (let i = 0; i < spineIds.length; i++) {
    const href = manifest.get(spineIds[i]);
    if (!href) continue;
    const path = resolveZipPath(opfPath, href);
    const file = zip.file(path);
    if (!file) continue;
    const xhtml = await file.async('string');
    const bodyMatch = xhtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch?.[1] || xhtml;
    const headingFromHtml =
      body
        .match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1]
        ?.replace(/<[^>]+>/g, '')
        .trim() || '';
    const headingFromPath = (() => {
      const base = path.split('/').pop() || '';
      try {
        return decodeURIComponent(base)
          .replace(/\.(x?html|htm|xml)$/i, '')
          .replace(/[-_]+/g, ' ')
          .trim();
      } catch {
        return base.replace(/\.(x?html|htm|xml)$/i, '').trim();
      }
    })();
    const heading =
      headingFromHtml ||
      headingFromPath ||
      `片段 ${chapters.length + 1}`;
    const text = stripHtml(body);
    if (text.length < 8) continue;
    const cleaned = body
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<img[^>]*>/gi, '');
    chapters.push({
      title: heading,
      html: rewriteEpubLinks(cleaned),
      text,
      path,
    });
  }

  if (chapters.length === 0) {
    throw new Error('未能从 EPUB 中提取到正文');
  }

  return { title: bookTitle, chapters, format: 'epub' };
}

export async function parseEbookFile(file: File): Promise<ParsedEbook> {
  const name = file.name;
  const lower = name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (lower.endsWith('.txt')) {
    return splitTxtChapters(decodeTextBuffer(buffer), name);
  }

  if (lower.endsWith('.epub')) {
    return parseEpub(buffer, name);
  }

  if (lower.endsWith('.pdf')) {
    return parsePdfFile(buffer, name);
  }

  throw new Error('仅支持 TXT / EPUB / PDF 文件');
}
