'use client';

import { useEffect, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { VocabEntry } from '@/lib/vocabulary';
import InteractiveTitle from '@/components/InteractiveTitle';
import ModalPortal from '@/components/ModalPortal';

interface VocabularyStudioProps {
  initialEntries: VocabEntry[];
}

type ViewMode = 'list' | 'flash';
type CoverMode = 'none' | 'chinese' | 'english';

export default function VocabularyStudio({
  initialEntries,
}: VocabularyStudioProps) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [view, setView] = useState<ViewMode>('list');
  const [cover, setCover] = useState<CoverMode>('none');
  const [flashIndex, setFlashIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [english, setEnglish] = useState('');
  const [chinese, setChinese] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<VocabEntry | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  useEffect(() => {
    setFlashIndex(0);
    setFlipped(false);
  }, [entries.length, view]);

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

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const current = entries[flashIndex] ?? null;

  function goFlash(delta: number) {
    if (entries.length === 0) return;
    setFlipped(false);
    setFlashIndex((i) => (i + delta + entries.length) % entries.length);
  }

  return (
    <section className="relative z-10 mx-auto max-w-3xl pl-3 sm:px-2 md:px-4">
      <header className="mb-8 text-center sm:mb-10">
        <InteractiveTitle
          text="Vocabulary"
          variant="page"
          className="text-3xl sm:text-4xl md:text-5xl"
        />
        <p className="mt-3 text-[11px] tracking-[0.18em] text-ink-muted sm:mt-4 sm:text-sm sm:tracking-[0.2em]">
          WORDS WORTH KEEPING
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-8 sm:gap-3">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`interactive-btn border px-4 py-2 text-[10px] tracking-[0.22em] sm:text-xs ${
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
            className={`interactive-btn border px-4 py-2 text-[10px] tracking-[0.22em] sm:text-xs ${
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
            className="interactive-btn border border-[#c9a84c]/70 bg-[#c9a84c]/10 px-4 py-2 text-[10px] tracking-[0.22em] text-ink hover:bg-[#c9a84c]/20 sm:text-xs sm:tracking-[0.28em]"
          >
            + ADD WORD
          </button>
        </div>

        {view === 'list' && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[10px] tracking-[0.18em] text-ink-muted">
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
                className={`border px-3 py-1 text-[10px] tracking-wider transition ${
                  cover === mode
                    ? 'border-[#8c6d58]/50 bg-[#8c6d58]/10 text-ink'
                    : 'border-ink/15 text-ink-muted hover:border-[#c9a84c]/40 hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {entries.length === 0 ? (
        <div className="rounded-sm border border-white/70 bg-white/55 px-6 py-14 text-center shadow-card backdrop-blur-md">
          <p className="font-display text-lg text-ink-light">尚无词汇</p>
          <p className="mt-2 text-xs tracking-wider text-ink-muted">
            手动添加，或在 Reading 中选中英文后导入
          </p>
        </div>
      ) : view === 'list' ? (
        <div className="overflow-hidden rounded-sm border border-white/70 bg-white/55 shadow-card backdrop-blur-md">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-ink/10 px-3 py-2.5 text-[10px] tracking-[0.2em] text-ink-muted sm:px-5 sm:py-3 sm:text-xs">
            <span>ENGLISH</span>
            <span>中文</span>
            <span className="w-16 text-right sm:w-20"> </span>
          </div>
          <ul className="divide-y divide-ink/8">
            {entries.map((entry) => {
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
              {flashIndex + 1} / {entries.length}
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
