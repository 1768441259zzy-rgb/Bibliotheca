import type { ParsedEbook } from '@/lib/reading/parseEbook';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

/** Word .docx → 章节（旧版 .doc 不支持，请另存为 .docx） */
export async function parseDocxFile(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ParsedEbook> {
  const mammoth = await import('mammoth');
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='标题 1'] => h1:fresh",
        "p[style-name='标题 2'] => h2:fresh",
        "p[style-name='标题 3'] => h3:fresh",
      ],
    }
  );

  let html = (result.value || '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<a\b[^>]*>/gi, '')
    .replace(/<\/a>/gi, '')
    .trim();

  if (!html) {
    throw new Error('未能从 Word 中提取到正文');
  }

  // 按标题粗分章；没有标题则整篇一章
  const parts = html.split(/(?=<h[1-3]\b[^>]*>)/i).filter((p) => p.trim());
  const chapters =
    parts.length > 1
      ? parts.map((chunk, i) => {
          const title =
            chunk
              .match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1]
              ?.replace(/<[^>]+>/g, '')
              .trim() || `章节 ${i + 1}`;
          const body = chunk.replace(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/i, '').trim();
          const safeBody =
            body ||
            chunk
              .split(/\n{2,}/)
              .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
              .join('');
          return {
            title,
            html: safeBody,
            text: stripHtml(safeBody || chunk),
          };
        })
      : [
          {
            title: fileName.replace(/\.[^.]+$/, '') || '正文',
            html,
            text: stripHtml(html),
          },
        ];

  const usable = chapters.filter((c) => c.text.length > 0);
  if (usable.length === 0) {
    throw new Error('Word 内容为空或无法识别');
  }

  return {
    title: fileName.replace(/\.[^.]+$/, '') || 'Untitled',
    chapters: usable,
    format: 'docx',
  };
}
