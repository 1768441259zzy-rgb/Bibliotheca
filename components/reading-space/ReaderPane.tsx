'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ParsedEbook } from '@/lib/reading/parseEbook';
import {
  findChapterIndexByPath,
  parseEbookFile,
  resolveZipPath,
} from '@/lib/reading/parseEbook';
import { renderPdfPage } from '@/lib/reading/parsePdf';
import {
  READING_ANNOTATION_COLORS,
  annotationsForBook,
  syncMarksInContainer,
  buildHighlightQuote,
  readAnnotations,
  removeAnnotation,
  updateAnnotation,
  upsertAnnotation,
  wrapRangeWithMark,
  type ReadingAnnotation,
} from '@/lib/reading/annotations';
import SelectionMenu from '@/components/reading-space/SelectionMenu';
import NoteComposer from '@/components/reading-space/NoteComposer';
import VocabComposer from '@/components/reading-space/VocabComposer';
import AnnotationPanel from '@/components/reading-space/AnnotationPanel';
import ReadingHistory from '@/components/reading-space/ReadingHistory';
import {
  persistOpenedBook,
  updateSessionProgress,
  type ReadingSessionMeta,
} from '@/lib/reading/readingStore';

interface ReaderPaneProps {
  book: ParsedEbook | null;
  sessionId: string | null;
  restoreMeta: ReadingSessionMeta | null;
  sessions: ReadingSessionMeta[];
  onBookLoaded: (book: ParsedEbook, meta: ReadingSessionMeta) => void;
  onSessionChange: (id: string, meta: ReadingSessionMeta) => void;
  onOpenSession: (id: string) => void;
  onRemoveSession: (id: string) => void;
  onError: (message: string) => void;
}

interface PopupState {
  x: number;
  y: number;
  text: string;
  range: Range;
}

type NoteDraft =
  | { mode: 'create'; quote: string; range: Range | null }
  | { mode: 'edit'; annotation: ReadingAnnotation };

export default function ReaderPane({
  book,
  sessionId,
  restoreMeta,
  sessions,
  onBookLoaded,
  onSessionChange,
  onOpenSession,
  onRemoveSession,
  onError,
}: ReaderPaneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [localError, setLocalError] = useState('');
  const [pdfImage, setPdfImage] = useState('');
  const [pdfRendering, setPdfRendering] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLElement>(null);
  const renderSeq = useRef(0);
  const savedRangeRef = useRef<Range | null>(null);
  const appliedSessionRef = useRef<string | null>(null);
  const skipChapterScrollRef = useRef(false);
  const pendingFragmentRef = useRef<string | null>(null);

  const [annotations, setAnnotations] = useState<ReadingAnnotation[]>([]);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);
  const [vocabDraft, setVocabDraft] = useState<{
    english: string;
    source?: string;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState('');
  const [tocOpen, setTocOpen] = useState(false);

  const bookTitle = book?.title ?? '';

  /** 从阅读记录恢复章节 / 字号 / 滚动位置 */
  useEffect(() => {
    if (!book || !sessionId) return;
    if (appliedSessionRef.current === sessionId) return;
    appliedSessionRef.current = sessionId;

    const meta = restoreMeta;
    const idx = Math.min(
      Math.max(0, meta?.chapterIndex ?? 0),
      Math.max(0, book.chapters.length - 1)
    );
    skipChapterScrollRef.current = true;
    setChapterIndex(idx);
    setFontScale(meta?.fontScale && meta.fontScale > 0 ? meta.fontScale : 1);
    const top = meta?.scrollTop ?? 0;
    window.setTimeout(() => {
      scrollerRef.current?.scrollTo({ top });
    }, 60);
  }, [book, sessionId, restoreMeta]);

  useEffect(() => {
    if (skipChapterScrollRef.current) {
      skipChapterScrollRef.current = false;
      return;
    }
    scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [chapterIndex]);

  useEffect(() => {
    if (!bookTitle) {
      setAnnotations([]);
      return;
    }
    setAnnotations(annotationsForBook(bookTitle));
  }, [bookTitle]);

  /** 进度自动写入阅读记录 */
  useEffect(() => {
    if (!sessionId || !book) return;
    const timer = window.setTimeout(() => {
      const scrollTop = scrollerRef.current?.scrollTop ?? 0;
      void updateSessionProgress(sessionId, {
        chapterIndex,
        fontScale,
        scrollTop,
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [sessionId, book, chapterIndex, fontScale]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !sessionId) return;
    let t: number | undefined;
    const onScroll = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        void updateSessionProgress(sessionId, {
          scrollTop: el.scrollTop,
        });
      }, 400);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.clearTimeout(t);
    };
  }, [sessionId, book?.title]);

  useEffect(() => {
    let cancelled = false;
    const seq = ++renderSeq.current;

    async function render() {
      if (!book || book.format !== 'pdf' || !book.pdfData) {
        setPdfImage('');
        setPdfRendering(false);
        return;
      }

      setPdfRendering(true);
      setLocalError('');
      setStatus(`正在渲染第 ${chapterIndex + 1} 页…`);

      try {
        const url = await renderPdfPage(book.pdfData, chapterIndex + 1);
        if (!cancelled && seq === renderSeq.current) {
          setPdfImage(url);
          setStatus('');
        }
      } catch (err) {
        if (!cancelled && seq === renderSeq.current) {
          setPdfImage('');
          const msg =
            err instanceof Error ? err.message : 'PDF 页面渲染失败';
          setLocalError(msg);
          onError(msg);
          setStatus('');
        }
      } finally {
        if (!cancelled && seq === renderSeq.current) {
          setPdfRendering(false);
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [book, chapterIndex, onError]);

  const chapter = book?.chapters[chapterIndex];
  const progress = useMemo(() => {
    if (!book?.chapters.length) return 0;
    return Math.round(((chapterIndex + 1) / book.chapters.length) * 100);
  }, [book, chapterIndex]);

  const navLabel = book?.format === 'pdf' ? '页' : '篇';
  const chapterAnnotations = useMemo(
    () =>
      annotations.filter(
        (a) => a.bookTitle === bookTitle && a.chapterIndex === chapterIndex
      ),
    [annotations, bookTitle, chapterIndex]
  );

  const annotationKey = useMemo(
    () => chapterAnnotations.map((a) => a.id).join('|'),
    [chapterAnnotations]
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2200);
  }, []);

  /** 用命令式 DOM 渲染正文，避免 React 重绘把高亮 mark 冲掉 */
  useEffect(() => {
    const root = proseRef.current;
    if (!root || !book || !chapter || book.format === 'pdf') return;

    const title = document.createElement('h2');
    title.className =
      'mb-8 text-center font-display text-[1.35em] font-light tracking-wide text-[#5c4033]';
    title.textContent = chapter.title;

    const body = document.createElement('div');
    body.className = 'epub-body';
    if (book.format === 'epub') {
      // EPUB 正文自带标题，不再额外插入「第 n 章」之类合成标题
      body.innerHTML = chapter.html;
      root.replaceChildren(body);
    } else {
      body.innerHTML = chapter.text
        .split(/\n{2,}/)
        .map((para) => {
          const safe = para
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
          return `<p>${safe}</p>`;
        })
        .join('');
      // TXT：仅当标题不像自动「段落 n」时才显示
      if (chapter.title && !/^段落\s*\d+$/.test(chapter.title)) {
        root.replaceChildren(title, body);
      } else {
        root.replaceChildren(body);
      }
    }
    syncMarksInContainer(root, chapterAnnotations);
    // chapterAnnotations 在本 effect 只用于初次挂载本章；后续靠 annotationKey effect 增量同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.title, book?.format, chapterIndex, chapter?.html, chapter?.text]);

  /** EPUB 内部链接：跳章节 / 锚点，避免当成站点路由导致 404 */
  useEffect(() => {
    const root = proseRef.current;
    if (!root || !book || book.format !== 'epub') return;

    const scrollToFragment = (frag: string) => {
      const id = decodeURIComponent(frag);
      if (!id) return;
      const el =
        root.querySelector(`#${CSS.escape(id)}`) ||
        root.querySelector(`[name="${CSS.escape(id)}"]`) ||
        root.querySelector(`a[id="${CSS.escape(id)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      // 部分 EPUB 用页码 id，宽松再找一次
      const loose = Array.from(root.querySelectorAll<HTMLElement>('[id]')).find(
        (node) => node.id.toLowerCase() === id.toLowerCase()
      );
      loose?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const anchor = target?.closest?.('a');
      if (!anchor || !root.contains(anchor)) return;

      const raw =
        anchor.getAttribute('data-epub-href') ||
        anchor.getAttribute('href') ||
        '';
      if (!raw || raw === '#') {
        // 仅 # 且无 data：可能是改写后的空链，忽略
        if (!anchor.getAttribute('data-epub-href')) return;
      }

      if (/^(https?:|mailto:)/i.test(raw)) {
        e.preventDefault();
        window.open(raw, '_blank', 'noopener,noreferrer');
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const hashIdx = raw.indexOf('#');
      const pathPart = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
      const frag = hashIdx >= 0 ? raw.slice(hashIdx + 1) : '';

      if (!pathPart || pathPart === '#' || pathPart === '.') {
        if (frag) scrollToFragment(frag);
        return;
      }

      const currentPath = book.chapters[chapterIndex]?.path || '';
      const resolved = resolveZipPath(currentPath, pathPart);
      const nextIdx = findChapterIndexByPath(book.chapters, resolved);

      if (nextIdx < 0) {
        setToast('找不到对应章节，可尝试重新导入此 EPUB');
        window.setTimeout(() => setToast(''), 2200);
        return;
      }

      if (nextIdx === chapterIndex) {
        if (frag) scrollToFragment(frag);
        return;
      }

      pendingFragmentRef.current = frag || null;
      skipChapterScrollRef.current = Boolean(frag);
      setChapterIndex(nextIdx);
    };

    root.addEventListener('click', onClick, true);
    return () => root.removeEventListener('click', onClick, true);
  }, [book, chapterIndex]);

  /** 跨章跳转后滚到锚点 */
  useEffect(() => {
    if (!book || book.format !== 'epub') return;
    const frag = pendingFragmentRef.current;
    if (!frag || !proseRef.current) return;
    pendingFragmentRef.current = null;
    const root = proseRef.current;
    const id = decodeURIComponent(frag);
    const run = () => {
      const el =
        root.querySelector(`#${CSS.escape(id)}`) ||
        root.querySelector(`[name="${CSS.escape(id)}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const t = window.setTimeout(run, 40);
    return () => window.clearTimeout(t);
  }, [book, chapterIndex, chapter?.html]);

  /** 章节切换 / 内容重挂载后增量同步高亮（不拆已有 mark） */
  useEffect(() => {
    if (!book || book.format === 'pdf') return;
    let cancelled = false;
    let t2 = 0;
    const run = () => {
      if (cancelled || !proseRef.current) return;
      syncMarksInContainer(proseRef.current, chapterAnnotations);
    };
    const id = window.requestAnimationFrame(() => {
      run();
      t2 = window.setTimeout(run, 120);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    book?.title,
    chapterIndex,
    fontScale,
    annotationKey,
    chapter?.html,
    chapter?.text,
  ]);

  const clearSelectionUi = useCallback(() => {
    setPopup(null);
    savedRangeRef.current = null;
    const sel = window.getSelection();
    sel?.removeAllRanges();
  }, []);

  const onSelectionChange = useCallback(() => {
    if (!book || book.format === 'pdf') {
      setPopup(null);
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setPopup(null);
      return;
    }

    const text = sel.toString().trim();
    if (text.length < 2) {
      setPopup(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const container = proseRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) {
      setPopup(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      setPopup(null);
      return;
    }

    savedRangeRef.current = range.cloneRange();
    const menuTop = Math.max(rect.top - 45, 8);
    const menuLeft = rect.left + rect.width / 2;
    setPopup({
      x: Math.min(Math.max(menuLeft, 96), window.innerWidth - 96),
      y: menuTop,
      text,
      range: range.cloneRange(),
    });
  }, [book]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const onMouseUp = () => {
      window.setTimeout(onSelectionChange, 10);
    };
    const onScroll = () => setPopup(null);
    document.addEventListener('mouseup', onMouseUp);
    scroller?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      scroller?.removeEventListener('scroll', onScroll);
    };
  }, [onSelectionChange]);

  function createAnnotation(
    quote: string,
    note: string,
    range: Range | null
  ): ReadingAnnotation | null {
    if (!book || !chapter) return null;

    const id = `ra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const color =
      READING_ANNOTATION_COLORS[
        annotations.length % READING_ANNOTATION_COLORS.length
      ];

    const ann: ReadingAnnotation = {
      id,
      bookTitle: book.title,
      chapterIndex,
      chapterTitle: chapter.title,
      quote,
      note,
      color,
      createdAt: new Date().toISOString(),
      synced: false,
    };

    if (range && proseRef.current?.contains(range.commonAncestorContainer)) {
      wrapRangeWithMark(range, id, color);
    } else if (proseRef.current) {
      syncMarksInContainer(proseRef.current, [...chapterAnnotations, ann]);
    }

    const next = upsertAnnotation(ann);
    setAnnotations(annotationsForBook(book.title, next));
    return ann;
  }

  function handleHighlight() {
    if (!popup) return;
    const range = savedRangeRef.current ?? popup.range;
    createAnnotation(popup.text, '', range);
    clearSelectionUi();
    showToast('已涂上高亮');
  }

  function handleAddNote() {
    if (!popup) return;
    setNoteDraft({
      mode: 'create',
      quote: popup.text,
      range: savedRangeRef.current ?? popup.range,
    });
    setPopup(null);
  }

  function handleAddVocabulary() {
    if (!popup) return;
    const english = popup.text.trim().replace(/\s+/g, ' ');
    if (!english) return;
    setVocabDraft({
      english,
      source: book?.title || undefined,
    });
    setPopup(null);
  }

  async function syncAnnotationToHighlights(ann: ReadingAnnotation) {
    setImporting(true);
    try {
      const quote = buildHighlightQuote(ann.quote, ann.note, ann.createdAt);
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookTitle: ann.bookTitle,
          quotes: [quote],
          mergeByTitle: true,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || '导入失败');

      const next = updateAnnotation(ann.id, { synced: true });
      setAnnotations(annotationsForBook(ann.bookTitle, next));
      showToast('已导入 Highlights');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '导入失败';
      showToast(msg);
      onError(msg);
    } finally {
      setImporting(false);
    }
  }

  async function handleImportFromSelection() {
    if (!popup || !book || !chapter) return;
    const range = savedRangeRef.current ?? popup.range;
    const existing = annotations.find(
      (a) =>
        a.bookTitle === book.title &&
        a.chapterIndex === chapterIndex &&
        a.quote === popup.text
    );
    const ann =
      existing ?? createAnnotation(popup.text, '', range);
    clearSelectionUi();
    if (ann) await syncAnnotationToHighlights(ann);
  }

  function handleNoteSave(note: string) {
    if (!noteDraft) return;

    if (noteDraft.mode === 'edit') {
      const next = updateAnnotation(noteDraft.annotation.id, { note });
      setAnnotations(annotationsForBook(noteDraft.annotation.bookTitle, next));
      setNoteDraft(null);
      showToast('便笺已更新');
      return;
    }

    createAnnotation(noteDraft.quote, note, noteDraft.range);
    setNoteDraft(null);
    clearSelectionUi();
    showToast(note ? '高亮与便笺已保存' : '已涂上高亮');
  }

  function handleRemove(id: string) {
    const next = removeAnnotation(id);
    setAnnotations(bookTitle ? annotationsForBook(bookTitle, next) : readAnnotations());
    if (proseRef.current) {
      syncMarksInContainer(
        proseRef.current,
        annotationsForBook(bookTitle, next).filter(
          (a) => a.chapterIndex === chapterIndex
        )
      );
    }
  }

  async function onPickFile(file: File | null) {
    if (!file) return;
    setLoading(true);
    setPdfImage('');
    setLocalError('');
    setStatus(`正在打开「${file.name}」…`);
    onError('');
    clearSelectionUi();

    try {
      const parsed = await parseEbookFile(file);
      const meta = await persistOpenedBook(parsed, {
        chapterIndex: 0,
        fontScale,
        scrollTop: 0,
      });
      appliedSessionRef.current = meta.id;
      skipChapterScrollRef.current = true;
      setChapterIndex(0);
      onBookLoaded(parsed, meta);
      setStatus(
        parsed.format === 'pdf'
          ? `已载入并保存 · 共 ${parsed.pageCount ?? parsed.chapters.length} 页`
          : `已载入并保存 · 共 ${parsed.chapters.length} 篇`
      );
      window.setTimeout(() => setStatus(''), 2200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '导入失败';
      setLocalError(msg);
      onError(msg);
      setStatus('');
      console.error('Ebook import failed:', err);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="truncate font-display text-lg tracking-wide text-[#5c4033]">
            {book?.title || '尚未打开书卷'}
          </p>
          {book && (
            <p className="mt-1 font-serif text-[10px] tracking-[0.2em] text-[#8c6d58]/90">
              {chapter?.title} · {progress}%
            </p>
          )}
          {(status || localError || toast) && (
            <p
              className={`mt-1 font-serif text-[11px] ${
                localError ? 'text-[#a07060]' : 'text-[#8c6d58]/90'
              }`}
            >
              {localError || toast || status}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {book?.format !== 'pdf' && (
            <>
              <button
                type="button"
                onClick={() => setFontScale((s) => Math.max(0.85, s - 0.08))}
                className="border border-[#8c6d58]/35 bg-[#fdfbf7]/70 px-2.5 py-1 text-[10px] tracking-widest text-[#6b4f3f]"
              >
                A−
              </button>
              <button
                type="button"
                onClick={() => setFontScale((s) => Math.min(1.35, s + 0.08))}
                className="border border-[#8c6d58]/35 bg-[#fdfbf7]/70 px-2.5 py-1 text-[10px] tracking-widest text-[#6b4f3f]"
              >
                A+
              </button>
            </>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => fileRef.current?.click()}
            className="interactive-btn border border-[#c9a84c]/65 bg-[#c9a84c]/12 px-3 py-1.5 text-[10px] tracking-[0.2em] text-[#5c4033] hover:bg-[#c9a84c]/22 disabled:opacity-60"
          >
            {loading ? '解析中…' : '上传电子书'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.epub,.pdf,text/plain,application/epub+zip,application/pdf"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <div className="reader-page relative min-h-0 flex-1 overflow-hidden border border-[#8c6d58]/15 bg-[#fdfbf7]/25">
        <div
          ref={scrollerRef}
          className="reader-scroll absolute inset-0 overflow-y-auto overscroll-contain px-6 py-7 sm:px-10 sm:py-9 md:px-12"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {!book && !loading && (
            <div className="flex h-full min-h-[50vh] flex-col items-center justify-center text-center">
              <p className="font-display text-2xl font-light tracking-wide text-[#6b4f3f]">
                翻开一页静好
              </p>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#8c6d58]">
                上传 TXT、EPUB 或 PDF。划线、进度与氛围偏好都会自动保存。
              </p>
              {localError && (
                <p className="mt-4 max-w-sm text-sm text-[#b85c45]">{localError}</p>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="interactive-btn mt-8 border border-[#8c6d58]/45 bg-[#f7efe4]/80 px-5 py-2 text-xs tracking-[0.22em] text-[#5c4033]"
              >
                选择书卷
              </button>
              <div className="mt-8 w-full max-w-md text-left">
                <ReadingHistory
                  sessions={sessions}
                  activeId={sessionId}
                  onOpen={onOpenSession}
                  onRemove={onRemoveSession}
                />
              </div>
            </div>
          )}

          {loading && (
            <div className="flex h-full min-h-[50vh] flex-col items-center justify-center text-center">
              <p className="font-display text-xl text-[#6b4f3f]">正在打开书卷…</p>
              <p className="mt-2 text-sm text-[#8c6d58]">{status}</p>
            </div>
          )}

          {book && chapter && book.format === 'pdf' && (
            <div className="mx-auto flex max-w-3xl flex-col items-center">
              {pdfRendering && (
                <p className="py-16 text-sm text-[#8c6d58]">正在渲染这一页…</p>
              )}
              {!pdfRendering && pdfImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pdfImage}
                  alt={`${book.title} · ${chapterIndex + 1}`}
                  className="h-auto w-full border border-[#8c6d58]/15 shadow-[0_4px_20px_rgba(61,47,42,0.08)]"
                />
              )}
              {!pdfRendering && !pdfImage && (
                <p className="py-16 text-center text-sm text-[#b85c45]">
                  {localError || '这一页暂时无法显示，请换一份 PDF 试试'}
                </p>
              )}
              <p className="mt-4 text-center text-[11px] text-[#8c6d58]/80">
                PDF 以图像显示，划线功能请使用 TXT / EPUB
              </p>
            </div>
          )}

          {book && chapter && book.format !== 'pdf' && (
            <article
              ref={proseRef}
              className="reader-prose mx-auto max-w-2xl"
              style={{ fontSize: `${fontScale}rem` }}
            />
          )}
        </div>
      </div>

      {book && book.chapters.length > 1 && (
        <div className="relative mt-2 flex shrink-0 items-center justify-between gap-3 px-0.5">
          <button
            type="button"
            disabled={chapterIndex <= 0 || pdfRendering}
            onClick={() => setChapterIndex((i) => Math.max(0, i - 1))}
            className="border border-[#8c6d58]/30 bg-[#fdfbf7]/65 px-3 py-1 text-[10px] tracking-[0.18em] text-[#6b4f3f] disabled:opacity-35"
          >
            上一{navLabel}
          </button>

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTocOpen((v) => !v)}
              className={`border px-3 py-1 text-[10px] tracking-[0.18em] transition-colors ${
                tocOpen
                  ? 'border-[#8b3a2a]/40 bg-[#8b3a2a]/10 text-[#8b3a2a]'
                  : 'border-[#8c6d58]/30 bg-[#fdfbf7]/65 text-[#6b4f3f]'
              }`}
              aria-expanded={tocOpen}
            >
              目录
            </button>
            <p className="text-[10px] tracking-[0.18em] text-[#8c6d58]">
              {chapterIndex + 1} / {book.chapters.length}
            </p>

            {tocOpen && (
              <div className="absolute bottom-[calc(100%+0.4rem)] left-1/2 z-30 w-[min(18rem,calc(100vw-3rem))] -translate-x-1/2 border border-[#8c6d58]/25 bg-[#fdfbf7]/95 shadow-[0_12px_36px_rgba(61,47,42,0.16)] backdrop-blur-md">
                <p className="border-b border-[#8c6d58]/15 px-3 py-2 font-serif text-[9px] tracking-[0.2em] text-[#8c6d58]">
                  目录 · 点击跳转
                </p>
                <ul className="max-h-56 overflow-y-auto py-1 [scrollbar-width:thin]">
                  {book.chapters.map((ch, i) => {
                    const active = i === chapterIndex;
                    return (
                      <li key={`${ch.title}-${i}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setChapterIndex(i);
                            setTocOpen(false);
                          }}
                          className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${
                            active
                              ? 'bg-[#8b3a2a]/10 text-[#8b3a2a]'
                              : 'text-[#5c4033] hover:bg-[#8c6d58]/8'
                          }`}
                        >
                          <span className="shrink-0 pt-0.5 font-serif text-[9px] tracking-wider text-[#8c6d58]">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-display text-[12px]">
                            {ch.title || `片段 ${i + 1}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={
              chapterIndex >= book.chapters.length - 1 || pdfRendering
            }
            onClick={() =>
              setChapterIndex((i) => Math.min(book.chapters.length - 1, i + 1))
            }
            className="border border-[#8c6d58]/30 bg-[#fdfbf7]/65 px-3 py-1 text-[10px] tracking-[0.18em] text-[#6b4f3f] disabled:opacity-35"
          >
            下一{navLabel}
          </button>
        </div>
      )}

      {/* 贴底抽屉：默认收起，把高度还给正文 */}
      {book && (
        <div className="mt-2 shrink-0 overflow-hidden rounded-sm border border-[#8c6d58]/15">
          {book.format !== 'pdf' && (
            <AnnotationPanel
              compact
              annotations={annotations}
              onEditNote={(ann) =>
                setNoteDraft({ mode: 'edit', annotation: ann })
              }
              onRemove={handleRemove}
              onImport={(ann) => void syncAnnotationToHighlights(ann)}
              onJump={setChapterIndex}
            />
          )}
          <ReadingHistory
            compact
            sessions={sessions}
            activeId={sessionId}
            onOpen={onOpenSession}
            onRemove={onRemoveSession}
          />
        </div>
      )}

      {popup && (
        <SelectionMenu
          x={popup.x}
          y={popup.y}
          importing={importing}
          onHighlight={handleHighlight}
          onAddNote={handleAddNote}
          onImport={() => void handleImportFromSelection()}
          onAddVocabulary={handleAddVocabulary}
        />
      )}

      {noteDraft && (
        <NoteComposer
          quote={
            noteDraft.mode === 'edit'
              ? noteDraft.annotation.quote
              : noteDraft.quote
          }
          initialNote={
            noteDraft.mode === 'edit' ? noteDraft.annotation.note : ''
          }
          onCancel={() => setNoteDraft(null)}
          onSave={handleNoteSave}
        />
      )}

      {vocabDraft && (
        <VocabComposer
          english={vocabDraft.english}
          source={vocabDraft.source}
          onCancel={() => setVocabDraft(null)}
          onSaved={(message) => {
            setVocabDraft(null);
            clearSelectionUi();
            showToast(message);
          }}
        />
      )}
    </div>
  );
}
