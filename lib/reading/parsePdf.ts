import type { ParsedEbook, PdfReadMode } from '@/lib/reading/parseEbook';

/** pdfjs 文档实例（版本间 API 略有差异，用最小结构约束） */
type PdfTextItem = {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
  width?: number;
};

type PdfPage = {
  getViewport: (params: { scale: number }) => {
    width: number;
    height: number;
  };
  render: (params: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  getMetadata: () => Promise<{ info?: { Title?: string } } | null>;
  destroy?: () => Promise<void> | void;
  cleanup?: () => Promise<void> | void;
};

type PdfjsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: {
    data: Uint8Array;
    useSystemFonts?: boolean;
  }) => { promise: Promise<PdfDocument> };
};

let pdfjsLib: PdfjsLib | null = null;
let cached:
  | {
      key: Uint8Array;
      doc: PdfDocument;
    }
  | null = null;

/** Chrome < 145 等环境缺少该 API；与文件大小无关 */
function installMapGetOrInsertPolyfill() {
  const patch = (proto: object) => {
    const p = proto as {
      getOrInsert?: (key: unknown, value: unknown) => unknown;
      getOrInsertComputed?: (
        key: unknown,
        callbackfn: (key: unknown) => unknown
      ) => unknown;
      has: (key: unknown) => boolean;
      get: (key: unknown) => unknown;
      set: (key: unknown, value: unknown) => unknown;
    };
    if (typeof p.getOrInsert !== 'function') {
      p.getOrInsert = function getOrInsert(key, value) {
        if (!this.has(key)) this.set(key, value);
        return this.get(key);
      };
    }
    if (typeof p.getOrInsertComputed !== 'function') {
      p.getOrInsertComputed = function getOrInsertComputed(key, callbackfn) {
        if (!this.has(key)) this.set(key, callbackfn(key));
        return this.get(key);
      };
    }
  };
  patch(Map.prototype);
  patch(WeakMap.prototype);
}

async function ensurePdfjs(): Promise<PdfjsLib> {
  if (pdfjsLib) return pdfjsLib;
  if (typeof window === 'undefined') {
    throw new Error('PDF 只能在浏览器中打开');
  }

  installMapGetOrInsertPolyfill();

  // 动态 import 变量路径，避免 Next/webpack 二次打包弄丢 legacy polyfill
  const importPublic = new Function(
    'u',
    'return import(u)'
  ) as (u: string) => Promise<PdfjsLib>;
  const mod = await importPublic('/assets/pdf/pdf.min.mjs?v=6.2.108-legacy');

  mod.GlobalWorkerOptions.workerSrc =
    '/assets/pdf/pdf.worker.boot.mjs?v=6.2.108-legacy';
  pdfjsLib = mod;
  return mod;
}

async function getPdfDoc(pdfData: Uint8Array): Promise<PdfDocument> {
  if (cached?.key === pdfData) return cached.doc;
  if (cached) {
    try {
      await cached.doc.destroy?.();
      await cached.doc.cleanup?.();
    } catch {
      // ignore
    }
    cached = null;
  }
  const pdfjs = await ensurePdfjs();
  const doc = (await pdfjs.getDocument({
    data: pdfData.slice(0),
    useSystemFonts: true,
  }).promise) as unknown as PdfDocument;
  cached = { key: pdfData, doc };
  return doc;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 将 pdf.js 文本项拼成可选中的 HTML / 纯文本 */
function textContentToHtml(items: PdfTextItem[]): { html: string; text: string } {
  type Line = { y: number; parts: string[] };
  const lines: Line[] = [];

  for (const item of items) {
    const str = (item.str ?? '').replace(/\s+/g, ' ');
    if (!str && !item.hasEOL) continue;
    const y = Math.round(item.transform?.[5] ?? 0);
    const last = lines[lines.length - 1];
    if (!last || Math.abs(last.y - y) > 3) {
      lines.push({ y, parts: str ? [str] : [] });
    } else if (str) {
      const prev = last.parts[last.parts.length - 1] ?? '';
      if (prev && !/\s$/.test(prev) && !/^\s/.test(str)) {
        last.parts.push(' ');
      }
      last.parts.push(str);
    }
    if (item.hasEOL) {
      lines.push({ y: y - 1, parts: [] });
    }
  }

  const paragraphs: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    const joined = buf.join('').replace(/[ \t]+\n/g, '\n').trim();
    if (joined) paragraphs.push(joined);
    buf = [];
  };

  for (const line of lines) {
    const text = line.parts.join('').trim();
    if (!text) {
      flush();
      continue;
    }
    buf.push(text, '\n');
  }
  flush();

  const text = paragraphs.join('\n\n').trim();
  const html = paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return { html, text };
}

async function extractPageCopy(
  doc: PdfDocument,
  pageNumber: number
): Promise<{ html: string; text: string }> {
  try {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    return textContentToHtml(content.items ?? []);
  } catch (err) {
    console.warn(`PDF page ${pageNumber} text extract failed:`, err);
    return { html: '', text: '' };
  }
}

/**
 * 解析 PDF。
 * - text：抽取文字层（可划线）；无文字页阅读器会回退图像
 * - image：不抽文字，只按页图像翻阅（大文件 / 扫描件更合适）
 */
export async function parsePdfFile(
  buffer: ArrayBuffer,
  fileName: string,
  options?: { mode?: PdfReadMode }
): Promise<ParsedEbook> {
  const mode: PdfReadMode = options?.mode ?? 'text';
  const data = new Uint8Array(buffer.slice(0));
  const doc = await getPdfDoc(data);
  const pageCount = doc.numPages;

  if (pageCount < 1) {
    throw new Error('未能从 PDF 中读取到页面');
  }

  const meta = await doc.getMetadata().catch(() => null);
  const infoTitle =
    meta && typeof meta.info === 'object' && meta.info && 'Title' in meta.info
      ? String((meta.info as { Title?: string }).Title || '').trim()
      : '';
  const title =
    infoTitle || fileName.replace(/\.[^.]+$/, '') || 'Untitled PDF';

  if (mode === 'image') {
    const chapters = Array.from({ length: pageCount }, (_, i) => ({
      title: `第 ${i + 1} 页`,
      html: '',
      text: '',
    }));
    return {
      title,
      chapters,
      format: 'pdf',
      pdfData: data,
      pageCount,
      pdfMode: 'image',
    };
  }

  const chapters: ParsedEbook['chapters'] = [];
  const concurrency = 3;
  for (let start = 0; start < pageCount; start += concurrency) {
    const batch = Array.from(
      { length: Math.min(concurrency, pageCount - start) },
      (_, i) => start + i + 1
    );
    const parts = await Promise.all(
      batch.map(async (pageNumber) => {
        const copy = await extractPageCopy(doc, pageNumber);
        return {
          title: `第 ${pageNumber} 页`,
          html: copy.html,
          text: copy.text,
        };
      })
    );
    chapters.push(...parts);
  }

  return {
    title,
    chapters,
    format: 'pdf',
    pdfData: data,
    pageCount,
    pdfMode: 'text',
  };
}

export async function renderPdfPage(
  pdfData: Uint8Array,
  pageNumber: number,
  targetWidth = 820
): Promise<string> {
  const doc = await getPdfDoc(pdfData);
  const page = await doc.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, targetWidth / unscaled.width);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法渲染 PDF 页面');
  }
  ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);

  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
  }).promise;

  return canvas.toDataURL('image/jpeg', 0.9);
}
