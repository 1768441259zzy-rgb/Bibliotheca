import type { ParsedEbook } from '@/lib/reading/parseEbook';

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

let workerReady = false;
let cached:
  | {
      key: Uint8Array;
      doc: PdfDocument;
    }
  | null = null;

async function ensurePdfjs() {
  // legacy 构建自带 Map.getOrInsertComputed 等 polyfill；
  // 现代构建要求 Chrome 145+，多数浏览器会直接报错。
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdf/pdf.worker.min.mjs';
    workerReady = true;
  }
  return pdfjs;
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
 * 解析 PDF：尽量抽取文字层（可划线）；无文字的扫描页 text/html 为空，阅读器会回退到图像。
 * 大文件按页抽取，避免一次卡死。
 */
export async function parsePdfFile(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ParsedEbook> {
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

  const chapters: ParsedEbook['chapters'] = [];
  // 控制并发，避免一次性压垮主线程
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
    title: infoTitle || fileName.replace(/\.[^.]+$/, '') || 'Untitled PDF',
    chapters,
    format: 'pdf',
    pdfData: data,
    pageCount,
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
