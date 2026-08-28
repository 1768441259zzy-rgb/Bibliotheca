'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { VocabEntry } from '@/lib/vocabulary';
import { formatAnnotationDate } from '@/lib/reading/annotations';
import {
  exportVocabCsv,
  exportVocabExcel,
  exportVocabJson,
  exportVocabPdfPrint,
  exportVocabWord,
  parseVocabImportFile,
} from '@/lib/vocab-io';
import InteractiveTitle from '@/components/InteractiveTitle';
import ModalPortal from '@/components/ModalPortal';
import FloatingVocabIO, {
  type VocabExportFormat,
} from '@/components/FloatingVocabIO';

interface VocabularyStudioProps {
  initialEntries: VocabEntry[];
}

type ViewMode = 'list' | 'flash';
type CoverMode = 'none' | 'chinese' | 'english';
type SortOrder = 'newest' | 'oldest';

function sortEntries(list: VocabEntry[], order: SortOrder): VocabEntry[] {
  const next = [...list];
  next.sort((a, b) => {
    const ta = new Date(a.createdAt).getTime() || 0;
    const tb = new Date(b.createdAt).getTime() || 0;
    return order === 'newest' ? tb - ta : ta - tb;
  });
  return next;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type ListBlock =
  | { type: 'day'; key: string; label: string }
  | { type: 'entry'; entry: VocabEntry };

function buildListBlocks(list: VocabEntry[]): ListBlock[] {
  const blocks: ListBlock[] = [];
  let lastDay = '';
  for (const entry of list) {
    const key = dayKey(entry.createdAt);
    if (key !== lastDay) {
      lastDay = key;
      blocks.push({
        type: 'day',
        key,
        label:
          key === 'unknown'
            ? '日期未知'
            : formatAnnotationDate(entry.createdAt),
      });
    }
    blocks.push({ type: 'entry', entry });
  }
  return blocks;
}

type ExportFormat = VocabExportFormat;

export default function VocabularyStudio({
  initialEntries,
}: VocabularyStudioProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState(initialEntries);
  const [view, setView] = useState<ViewMode>('list');
  const [cover, setCover] = useState<CoverMode>('none');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [flashIndex, setFlashIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [english, setEnglish] = useState('');
  const [chinese, setChinese] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<VocabEntry | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const sortedEntries = useMemo(
    () => sortEntries(entries, sortOrder),
    [entries, sortOrder]
  );

  const listBlocks = useMemo(
    () => buildListBlocks(sortedEntries),
    [sortedEntries]
  );

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  useEffect(() => {
    setFlashIndex(0);
    setFlipped(false);
  }, [sortedEntries.length, view, sortOrder]);

  useEffect(() => {
    setRevealedIds(new Set());
  }, [cover]);

  function resetForm() {
    setEnglish('');
    setChinese('');
    setSource('');
    setEditingId(null);
    setError('');
  }

  function openAdd() {
    resetForm();
    setOpen(true);
  }

  function openEdit(entry: VocabEntry) {
    setEditingId(entry.id);
    setEnglish(entry.english);
    setChinese(entry.chinese);
    setSource(entry.source ?? '');
    setError('');
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!english.trim()) {
      setError('请填写英文');
      return;
    }

    setError('');
    startTransition(async () => {
      try {
        const res = await fetch('/api/vocabulary', {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(editingId ? { id: editingId } : {}),
            english,
            chinese,
            source,
          }),
        });
        const data = (await res.json()) as {
          entry?: VocabEntry;
          error?: string;
        };
        if (!res.ok || !data.entry) {
          setError(data.error || '保存失败');
          return;
        }

        if (editingId) {
          setEntries((prev) =>
            prev.map((x) => (x.id === data.entry!.id ? data.entry! : x))
          );
        } else {
          setEntries((prev) => [data.entry!, ...prev]);
        }
        closeModal();
        router.refresh();
      } catch {
        setError('网络异常，请稍后重试');
      }
    });
  }

  function handleDelete() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/vocabulary?id=${encodeURIComponent(target.id)}`,
          { method: 'DELETE' }
        );
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error || '删除失败');
          setConfirmDelete(null);
          return;
        }
        setEntries((prev) => prev.filter((x) => x.id !== target.id));
        setConfirmDelete(null);
        router.refresh();
      } catch {
        setError('网络异常，请稍后重试');
        setConfirmDelete(null);
      }
    });
  }

  async function handleExport(format: ExportFormat) {
    setError('');
    try {
      if (format === 'excel') {
        await exportVocabExcel(sortedEntries);
        setStatus(`已导出 Excel · ${sortedEntries.length} 条`);
      } else if (format === 'word') {
        await exportVocabWord(sortedEntries);
        setStatus(`已导出 Word · ${sortedEntries.length} 条`);
      } else if (format === 'pdf') {
        exportVocabPdfPrint(sortedEntries);
        setStatus('已打开打印页，可另存为 PDF');
      } else if (format === 'csv') {
        exportVocabCsv(sortedEntries);
        setStatus(`已导出 CSV · ${sortedEntries.length} 条`);
      } else {
        exportVocabJson(sortedEntries);
        setStatus(`已导出 JSON · ${sortedEntries.length} 条`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    }
  }

  function handleImportClick() {
    fileRef.current?.click();
  }

  function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setStatus('');
    startTransition(async () => {
      try {
        const items = await parseVocabImportFile(file);
        if (items.length === 0) {
          setError('文件里没有可识别的词条（请用 Excel / Word 表格）');
          return;
        }

        const res = await fetch('/api/vocabulary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'import', entries: items }),
        });
        const data = (await res.json()) as {
          added?: number;
          merged?: number;
          skipped?: number;
          entries?: VocabEntry[];
          error?: string;
        };
        if (!res.ok) {
          setError(data.error || '导入失败');
          return;
        }

        if (data.entries) setEntries(data.entries);
        setStatus(
          `导入完成：新增 ${data.added ?? 0} · 合并 ${data.merged ?? 0}${
            data.skipped ? ` · 跳过 ${data.skipped}` : ''
          }`
        );
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : '导入失败：请使用 Excel / Word / CSV / JSON'
        );
      }
    });
  }

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const current = sortedEntries[flashIndex] ?? null;

  function goFlash(delta: number) {
    if (sortedEntries.length === 0) return;
    setFlipped(false);
    setFlashIndex((i) => (i + delta + sortedEntries.length) % sortedEntries.length);
  }

  return (
    <section className="relative z-10 mx-auto max-w-3xl px-3 sm:px-4">
      <header className="mb-8 text-center sm:mb-10">
        <InteractiveTitle
          text="Vocabulary"
          variant="page"
          className="text-3xl sm:text-4xl md:text-5xl"
        />
        <p className="mt-3 text-[11px] tracking-[0.18em] text-ink-muted sm:mt-4 sm:text-sm sm:tracking-[0.2em]">
          WORDS WORTH KEEPING
        </p>

        <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-8 sm:gap-3">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`interactive-btn border px-4 py-2 text-[10px] tracking-[0.2em] sm:text-xs ${
              view === 'list'
                ? 'border-[#c9a84c]/80 bg-[#c9a84c]/20 text-ink'
                : 'border-[#c9a84c]/40 bg-[#c9a84c]/05 text-ink-muted hover:bg-[#c9a84c]/12'
            }`}
          >
            单词表
          </button>
          <button
            type="button"
            onClick={() => setView('flash')}
            className={`interactive-btn border px-4 py-2 text-[10px] tracking-[0.2em] sm:text-xs ${
              view === 'flash'
                ? 'border-[#c9a84c]/80 bg-[#c9a84c]/20 text-ink'
                : 'border-[#c9a84c]/40 bg-[#c9a84c]/05 text-ink-muted hover:bg-[#c9a84c]/12'
            }`}
          >
            记忆闪卡
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="interactive-btn border border-[#c9a84c]/70 bg-[#c9a84c]/10 px-4 py-2 text-[10px] tracking-[0.2em] text-ink hover:bg-[#c9a84c]/20 sm:text-xs"
          >
            + ADD WORD
          </button>
        </div>

        {status && (
          <p className="mt-3 text-[11px] tracking-wider text-ink-muted">
            {status}
          </p>
        )}
      </header>

      <FloatingVocabIO
        count={sortedEntries.length}
        pending={pending}
        canExport={sortedEntries.length > 0}
        onExport={(format) => void handleExport(format)}
        onImport={handleImportClick}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.docx,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json,text/csv,text/plain"
        className="hidden"
        onChange={handleImportFile}
      />

      {sortedEntries.length === 0 ? (
        <div className="rounded-sm border border-white/70 bg-white/55 px-6 py-14 text-center shadow-card backdrop-blur-md">
          <p className="font-display text-lg text-ink-light">尚无词汇</p>
          <p className="mt-2 text-xs tracking-wider text-ink-muted">
            手动添加，导入备份，或在 Reading 中选中英文后收录
          </p>
        </div>
      ) : view === 'list' ? (
        <div className="overflow-hidden rounded-sm border border-white/70 bg-white/55 shadow-card backdrop-blur-md">
          <div className="space-y-2.5 border-b border-ink/10 px-3 py-3 sm:px-5 sm:py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[10px] tracking-[0.18em] text-ink-muted">
                  遮盖
                </span>
                {(
                  [
                    ['none', '不遮'],
                    ['chinese', '遮中文'],
                    ['english', '遮英文'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCover(mode)}
                    className={`border px-2.5 py-1 text-[10px] tracking-[0.14em] transition ${
                      cover === mode
                        ? 'border-[#c9a84c]/70 bg-[#c9a84c]/15 text-ink'
                        : 'border-ink/10 text-ink-muted hover:border-[#c9a84c]/40 hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[10px] tracking-[0.18em] text-ink-muted">
                  排序
                </span>
                {(
                  [
                    ['newest', '最新'],
                    ['oldest', '最早'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSortOrder(mode)}
                    className={`border px-2.5 py-1 text-[10px] tracking-[0.14em] transition ${
                      sortOrder === mode
                        ? 'border-[#c9a84c]/70 bg-[#c9a84c]/15 text-ink'
                        : 'border-ink/10 text-ink-muted hover:border-[#c9a84c]/40 hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[10px] tracking-[0.2em] text-ink-muted sm:text-xs">
              <span>ENGLISH</span>
              <span>中文</span>
              <span className="w-16 text-right sm:w-20"> </span>
            </div>
          </div>
          <ul className="divide-y divide-ink/8">
            {listBlocks.map((block) => {
              if (block.type === 'day') {
                return (
                  <li
                    key={`day-${block.key}`}
                    className="bg-[#f3e6dc]/55 px-3 py-2 sm:px-5"
                  >
                    <time className="text-[10px] tracking-[0.22em] text-ink-muted sm:text-[11px]">
                      {block.label}
                    </time>
                  </li>
                );
              }

              const entry = block.entry;
              const revealed = revealedIds.has(entry.id);
              const hideEn = cover === 'english' && !revealed;
              const hideZh = cover === 'chinese' && !revealed;
              return (
                <li
                  key={entry.id}
                  className="grid grid-cols-[1fr_1fr_auto] items-start gap-2 px-3 py-3 sm:gap-3 sm:px-5 sm:py-3.5"
                >
                  <button
                    type="button"
                    onClick={() => cover !== 'none' && toggleReveal(entry.id)}
                    className={`min-w-0 text-left font-serif text-[13px] leading-snug text-ink sm:text-[15px] ${
                      cover !== 'none' ? 'cursor-pointer' : ''
                    }`}
                    title={
                      cover !== 'none' ? '点击显示 / 再次遮盖' : undefined
                    }
                  >
                    {hideEn ? (
                      <span className="inline-block min-h-[1.2em] w-full rounded-sm bg-[#e8dccf]/80 px-1">
                        &nbsp;
                      </span>
                    ) : (
                      entry.english
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => cover !== 'none' && toggleReveal(entry.id)}
                    className={`min-w-0 text-left font-serif text-[13px] leading-snug text-ink-light sm:text-[15px] ${
                      cover !== 'none' ? 'cursor-pointer' : ''
                    }`}
                    title={
                      cover !== 'none' ? '点击显示 / 再次遮盖' : undefined
                    }
                  >
                    {hideZh ? (
                      <span className="inline-block min-h-[1.2em] w-full rounded-sm bg-[#e8dccf]/80 px-1">
                        &nbsp;
                      </span>
                    ) : (
                      entry.chinese || (
                        <span className="text-ink-muted/60">（未填中文）</span>
                      )
                    )}
                  </button>
                  <div className="flex w-16 shrink-0 justify-end gap-1 sm:w-20">
                    <button
                      type="button"
                      onClick={() => openEdit(entry)}
                      className="border border-ink/15 bg-white/40 px-1.5 py-0.5 text-[9px] tracking-wider text-ink-muted transition hover:border-[#c9a84c]/50 hover:text-ink sm:text-[10px]"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(entry)}
                      className="border border-ink/15 bg-white/40 px-1.5 py-0.5 text-[9px] tracking-wider text-ink-muted transition hover:border-red-800/30 hover:text-red-900/80 sm:text-[10px]"
                    >
                      删
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="mx-auto max-w-md">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
            <span className="mr-1 text-[10px] tracking-[0.18em] text-ink-muted">
              排序
            </span>
            {(
              [
                ['newest', '最新'],
                ['oldest', '最早'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSortOrder(mode)}
                className={`border px-2.5 py-1 text-[10px] tracking-[0.14em] transition ${
                  sortOrder === mode
                    ? 'border-[#c9a84c]/70 bg-[#c9a84c]/15 text-ink'
                    : 'border-ink/10 text-ink-muted hover:border-[#c9a84c]/40 hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFlipped((v) => !v)}
            className="group relative flex min-h-[14rem] w-full flex-col items-center justify-center rounded-sm border border-white/70 bg-white/60 px-6 py-10 text-center shadow-card backdrop-blur-md transition hover:border-[#c9a84c]/40 sm:min-h-[16rem]"
          >
            <p className="text-[10px] tracking-[0.28em] text-ink-muted">
              {flipped ? '中文 · 再点翻回' : '英文 · 点击翻转'}
            </p>
            <p
              className={`mt-5 font-display leading-snug text-ink ${
                flipped
                  ? 'text-2xl sm:text-3xl'
                  : 'text-xl sm:text-2xl md:text-3xl'
              }`}
            >
              {current
                ? flipped
                  ? current.chinese || '（未填中文）'
                  : current.english
                : '—'}
            </p>
            {current?.source && (
              <p className="mt-4 text-[10px] tracking-wider text-ink-muted">
                · {current.source} ·
              </p>
            )}
            <p className="mt-6 text-[10px] tracking-[0.2em] text-ink-muted/80">
              {flashIndex + 1} / {sortedEntries.length}
            </p>
          </button>

          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => goFlash(-1)}
              className="interactive-btn border border-[#c9a84c]/50 bg-[#c9a84c]/08 px-5 py-2 text-xs tracking-[0.22em] text-ink hover:bg-[#c9a84c]/18"
            >
              ← 上一张
            </button>
            <button
              type="button"
              onClick={() => goFlash(1)}
              className="interactive-btn border border-[#c9a84c]/50 bg-[#c9a84c]/08 px-5 py-2 text-xs tracking-[0.22em] text-ink hover:bg-[#c9a84c]/18"
            >
              下一张 →
            </button>
          </div>
          {current && (
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => openEdit(current)}
                className="px-3 py-1 text-[10px] tracking-wider text-ink-muted hover:text-ink"
              >
                编辑此词
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(current)}
                className="px-3 py-1 text-[10px] tracking-wider text-ink-muted hover:text-red-900/80"
              >
                删除
              </button>
            </div>
          )}
        </div>
      )}

      {error && !open && (
        <p className="mt-4 text-center text-sm text-red-700/80">{error}</p>
      )}

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/30 px-4 py-8 backdrop-blur-[2px] modal-backdrop">
            <div className="modal-panel my-auto w-full max-w-md border border-[#c9a84c]/40 bg-[#fcf7f4]/95 p-6 shadow-card md:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-light text-ink">
                    {editingId ? '编辑词汇' : '添加词汇'}
                  </h2>
                  <p className="mt-1 text-xs tracking-wider text-ink-muted">
                    英文必填 · 中文可稍后补
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-ink-muted transition hover:text-ink"
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs tracking-widest text-ink-muted">
                    English *
                  </span>
                  <input
                    value={english}
                    onChange={(e) => setEnglish(e.target.value)}
                    className="w-full border border-ink/15 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-[#c9a84c]/70"
                    placeholder="e.g. serendipity"
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs tracking-widest text-ink-muted">
                    中文
                  </span>
                  <input
                    value={chinese}
                    onChange={(e) => setChinese(e.target.value)}
                    className="w-full border border-ink/15 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-[#c9a84c]/70"
                    placeholder="意外发现美好事物的能力"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs tracking-widest text-ink-muted">
                    来源（可选）
                  </span>
                  <input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full border border-ink/15 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-[#c9a84c]/70"
                    placeholder="书名 / 文章"
                  />
                </label>

                {error && <p className="text-sm text-red-700/80">{error}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-xs tracking-widest text-ink-muted transition hover:text-ink"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="interactive-btn border border-[#c9a84c]/70 bg-[#c9a84c]/15 px-5 py-2 text-xs tracking-[0.2em] text-ink hover:bg-[#c9a84c]/25 disabled:opacity-60"
                  >
                    {pending ? '保存中…' : '保存'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {confirmDelete && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/30 px-4 py-8 backdrop-blur-[2px] modal-backdrop">
            <div className="modal-panel my-auto w-full max-w-sm border border-[#c9a84c]/40 bg-[#fcf7f4]/95 p-6 shadow-card">
              <h2 className="font-display text-xl font-light text-ink">
                删除这个词？
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                将移除「{confirmDelete.english}」，此操作不可撤销。
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 text-xs tracking-widest text-ink-muted transition hover:text-ink"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleDelete}
                  className="interactive-btn border border-red-800/40 bg-red-900/10 px-5 py-2 text-xs tracking-[0.2em] text-ink hover:bg-red-900/20 disabled:opacity-60"
                >
                  {pending ? '删除中…' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </section>
  );
}
