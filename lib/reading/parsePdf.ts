import type { ParsedEbook } from '@/lib/reading/parseEbook';

/** pdfjs 文档实例（版本间 API 略有差异，用最小结构约束） */
type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getViewport: (params: { scale: number }) => {
      width: number;
      height: number;
    };
    render: (params: {
      canvas: HTMLCanvasElement;
      canvasContext: CanvasRenderingContext2D;
      viewport: { width: number; height: number };
    }) => { promise: Promise<void> };
  }>;
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
  const pdfjs = await import('pdfjs-dist');
  if (!workerReady) {
    // 优先本地 worker；失败时由调用方提示
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
    // 关闭不必要的字体扫描，加快首屏
    useSystemFonts: true,
  }).promise) as unknown as PdfDocument;
  cached = { key: pdfData, doc };
  return doc;
}

/** 只读取页数与标题，不做逐页抽文本（避免大 PDF 卡住） */
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

  const chapters = Array.from({ length: pageCount }, (_, i) => ({
    title: `第 ${i + 1} 页`,
    html: '',
    text: '',
  }));

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
