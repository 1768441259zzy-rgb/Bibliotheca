export interface ReadingAnnotation {
  id: string;
  bookTitle: string;
  chapterIndex: number;
  chapterTitle: string;
  quote: string;
  note: string;
  color: string;
  createdAt: string;
  synced: boolean;
}

export const READING_ANNOTATION_COLORS = [
  'rgba(232, 196, 112, 0.55)',
  'rgba(212, 168, 90, 0.5)',
  'rgba(224, 170, 140, 0.48)',
] as const;

const STORAGE_KEY = 'bibliotheca-reading-annotations';

export function formatAnnotationDate(iso = new Date().toISOString()): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/** 构建同步到 Highlights 页的摘抄文案 */
export function buildHighlightQuote(
  quote: string,
  note: string,
  createdAt: string
): string {
  const date = formatAnnotationDate(createdAt);
  const body = quote.trim();
  if (note.trim()) {
    return `${body}\n—— 感悟｜${note.trim()} · ${date}`;
  }
  return `${body}\n—— ${date}`;
}

export function readAnnotations(): ReadingAnnotation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReadingAnnotation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeAnnotations(items: ReadingAnnotation[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function upsertAnnotation(item: ReadingAnnotation): ReadingAnnotation[] {
  const all = readAnnotations();
  const idx = all.findIndex((a) => a.id === item.id);
  if (idx >= 0) all[idx] = item;
  else all.unshift(item);
  writeAnnotations(all);
  return all;
}

export function updateAnnotation(
  id: string,
  patch: Partial<ReadingAnnotation>
): ReadingAnnotation[] {
  const all = readAnnotations().map((a) =>
    a.id === id ? { ...a, ...patch } : a
  );
  writeAnnotations(all);
  return all;
}

export function removeAnnotation(id: string): ReadingAnnotation[] {
  const all = readAnnotations().filter((a) => a.id !== id);
  writeAnnotations(all);
  return all;
}

export function annotationsForBook(
  bookTitle: string,
  items?: ReadingAnnotation[]
): ReadingAnnotation[] {
  const list = items ?? readAnnotations();
  return list.filter((a) => a.bookTitle === bookTitle);
}

/** 增量同步高亮：已有 mark 不拆不补，避免闪烁消失 */
export function syncMarksInContainer(
  root: HTMLElement,
  annotations: ReadingAnnotation[]
): void {
  const wanted = new Map(annotations.map((a) => [a.id, a]));
  const present = new Set<string>();

  root.querySelectorAll('mark.reading-mark').forEach((el) => {
    const id = (el as HTMLElement).dataset.annotationId ?? '';
    if (!id || !wanted.has(id)) {
      unwrapMark(el);
    } else {
      present.add(id);
      const ann = wanted.get(id)!;
      (el as HTMLElement).style.backgroundColor = ann.color;
    }
  });

  for (const ann of annotations) {
    if (present.has(ann.id)) continue;
    wrapQuoteInRoot(root, ann.quote, ann.id, ann.color);
  }
}

/** @deprecated 使用 syncMarksInContainer，避免全量拆装闪烁 */
export function applyMarksInContainer(
  root: HTMLElement,
  annotations: ReadingAnnotation[]
): void {
  syncMarksInContainer(root, annotations);
}

function unwrapMark(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
  parent.normalize();
}

export function wrapRangeWithMark(
  range: Range,
  id: string,
  color: string
): boolean {
  const mark = document.createElement('mark');
  mark.className = 'reading-mark';
  mark.dataset.annotationId = id;
  mark.style.backgroundColor = color;

  try {
    range.surroundContents(mark);
    return true;
  } catch {
    try {
      const frag = range.extractContents();
      mark.appendChild(frag);
      range.insertNode(mark);
      return true;
    } catch {
      return false;
    }
  }
}

function normalizeMatchText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function wrapQuoteInRoot(
  root: HTMLElement,
  quote: string,
  id: string,
  color: string
): boolean {
  const needle = quote.trim();
  if (!needle) return false;

  // 1) 精确匹配
  if (wrapExactInTextNodes(root, needle, id, color)) return true;

  // 2) 空白折叠后匹配（跨换行选中的句子）
  const normNeedle = normalizeMatchText(needle);
  if (!normNeedle || normNeedle === needle) return false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const chunks: { node: Text; start: number; end: number; text: string }[] = [];
  let full = '';
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!(node instanceof Text)) continue;
    if (node.parentElement?.closest('mark.reading-mark')) continue;
    const text = node.textContent ?? '';
    if (!text) continue;
    const start = full.length;
    full += text;
    chunks.push({ node, start, end: full.length, text });
  }

  const normFull = full.replace(/\s+/g, ' ');
  // 建立 normFull 下标 → full 下标 的粗略映射
  const map: number[] = [];
  let fi = 0;
  for (let ni = 0; ni < normFull.length; ni++) {
    while (fi < full.length && /\s/.test(full[fi]) && normFull[ni] !== ' ') {
      fi++;
    }
    if (fi < full.length && /\s/.test(full[fi]) && normFull[ni] === ' ') {
      map[ni] = fi;
      fi++;
      while (fi < full.length && /\s/.test(full[fi])) fi++;
      continue;
    }
    map[ni] = fi;
    fi++;
  }

  const nIdx = normFull.indexOf(normNeedle);
  if (nIdx === -1) return false;
  const rawStart = map[nIdx] ?? 0;
  const rawEnd =
    map[nIdx + normNeedle.length - 1] !== undefined
      ? (map[nIdx + normNeedle.length - 1] as number) + 1
      : rawStart + needle.length;

  const startChunk = chunks.find(
    (c) => rawStart >= c.start && rawStart < c.end
  );
  const endChunk = chunks.find((c) => rawEnd > c.start && rawEnd <= c.end);
  if (!startChunk || !endChunk) return false;

  try {
    const range = document.createRange();
    range.setStart(startChunk.node, rawStart - startChunk.start);
    range.setEnd(endChunk.node, rawEnd - endChunk.start);
    return wrapRangeWithMark(range, id, color);
  } catch {
    return false;
  }
}

function wrapExactInTextNodes(
  root: HTMLElement,
  needle: string,
  id: string,
  color: string
): boolean {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!(node instanceof Text)) continue;
    if (node.parentElement?.closest('mark.reading-mark')) continue;

    const content = node.textContent ?? '';
    const idx = content.indexOf(needle);
    if (idx === -1) continue;

    const range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, idx + needle.length);
    return wrapRangeWithMark(range, id, color);
  }
  return false;
}
