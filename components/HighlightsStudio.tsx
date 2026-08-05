'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { HighlightGroup } from '@/data/content';
import HighlightCard from '@/components/HighlightCard';
import InteractiveTitle from '@/components/InteractiveTitle';
import ModalPortal from '@/components/ModalPortal';
import FloatingSideIndex from '@/components/FloatingSideIndex';

interface HighlightsStudioProps {
  initialGroups: HighlightGroup[];
}

type ModalMode = 'add' | 'edit-group' | 'edit-quote';

type ConfirmState =
  | { type: 'group'; group: HighlightGroup }
  | { type: 'quote'; group: HighlightGroup; quoteIndex: number }
  | null;

export default function HighlightsStudio({
  initialGroups,
}: HighlightsStudioProps) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQuoteIndex, setEditingQuoteIndex] = useState<number | null>(null);
  const [bookTitle, setBookTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [quotes, setQuotes] = useState<string[]>(['']);
  const [singleQuote, setSingleQuote] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  function resetForm() {
    setBookTitle('');
    setAuthor('');
    setQuotes(['']);
    setSingleQuote('');
    setError('');
    setEditingId(null);
    setEditingQuoteIndex(null);
    setMode('add');
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  function openAdd() {
    resetForm();
    setMode('add');
    setOpen(true);
  }

  function openEditGroup(group: HighlightGroup) {
    setMode('edit-group');
    setEditingId(group.id);
    setBookTitle(group.bookTitle);
    setAuthor(group.author ?? '');
    setQuotes(group.quotes.length ? [...group.quotes] : ['']);
    setSingleQuote('');
    setError('');
    setOpen(true);
  }

  function openEditQuote(group: HighlightGroup, quoteIndex: number) {
    setMode('edit-quote');
    setEditingId(group.id);
    setEditingQuoteIndex(quoteIndex);
    setBookTitle(group.bookTitle);
    setSingleQuote(group.quotes[quoteIndex] ?? '');
    setError('');
    setOpen(true);
  }

  function updateQuote(index: number, value: string) {
    setQuotes((prev) => prev.map((q, i) => (i === index ? value : q)));
  }

  function addQuoteField() {
    setQuotes((prev) => [...prev, '']);
  }

  function removeQuoteField(index: number) {
    setQuotes((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  }

  function applyGroupUpdate(group: HighlightGroup) {
    setGroups((prev) => prev.map((g) => (g.id === group.id ? group : g)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (mode === 'edit-quote') {
      if (!editingId || editingQuoteIndex === null) return;
      if (!singleQuote.trim()) {
        setError('摘抄内容不能为空');
        return;
      }

      setError('');
      startTransition(async () => {
        try {
          const res = await fetch('/api/highlights', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: editingId,
              quoteIndex: editingQuoteIndex,
              quote: singleQuote.trim(),
            }),
          });
          const data = (await res.json()) as {
            group?: HighlightGroup;
            error?: string;
          };
          if (!res.ok || !data.group) {
            setError(data.error || '更新失败');
            return;
          }
          applyGroupUpdate(data.group);
          closeModal();
          router.refresh();
        } catch {
          setError('网络异常，请稍后重试');
        }
      });
      return;
    }

    const cleanedQuotes = quotes.map((q) => q.trim()).filter(Boolean);

    if (!bookTitle.trim()) {
      setError('请填写书名 / 文章标题');
      return;
    }
    if (cleanedQuotes.length === 0) {
      setError(mode === 'edit-group' ? '请至少保留一句摘抄' : '请至少添加一句摘抄');
      return;
    }

    setError('');
    startTransition(async () => {
      try {
        const isEdit = mode === 'edit-group';
        const res = await fetch('/api/highlights', {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(isEdit && editingId ? { id: editingId } : {}),
            bookTitle: bookTitle.trim(),
            author: author.trim(),
            quotes: cleanedQuotes,
          }),
        });
        const data = (await res.json()) as {
          group?: HighlightGroup;
          error?: string;
        };
        if (!res.ok || !data.group) {
          setError(data.error || '保存失败');
          return;
        }

        if (isEdit) applyGroupUpdate(data.group);
        else setGroups((prev) => [...prev, data.group!]);

        closeModal();
        router.refresh();
      } catch {
        setError('网络异常，请稍后重试');
      }
    });
  }

  function handleConfirmDelete() {
    if (!confirm) return;
    const target = confirm;

    startTransition(async () => {
      try {
        const url =
          target.type === 'quote'
            ? `/api/highlights?id=${encodeURIComponent(target.group.id)}&quoteIndex=${target.quoteIndex}`
            : `/api/highlights?id=${encodeURIComponent(target.group.id)}`;

        const res = await fetch(url, { method: 'DELETE' });
        const data = (await res.json()) as {
          ok?: boolean;
          deletedGroup?: boolean;
          group?: HighlightGroup | null;
          error?: string;
        };

        if (!res.ok || !data.ok) {
          setError(data.error || '删除失败');
          setConfirm(null);
          return;
        }

        if (target.type === 'group' || data.deletedGroup) {
          setGroups((prev) => prev.filter((g) => g.id !== target.group.id));
        } else if (data.group) {
          applyGroupUpdate(data.group);
        }

        setConfirm(null);
        router.refresh();
      } catch {
        setError('网络异常，请稍后重试');
        setConfirm(null);
      }
    });
  }

  const modalTitle =
    mode === 'add'
      ? '添加新摘抄'
      : mode === 'edit-group'
        ? '编辑摘抄'
        : '编辑这句话';

  const modalHint =
    mode === 'add'
      ? '一书一组，可写入多句金句'
      : mode === 'edit-group'
        ? '可改书名、作者与全部句子'
        : `来自「${bookTitle}」`;

  return (
    <section className="relative z-10 mx-auto max-w-3xl px-4">
      <FloatingSideIndex groups={groups} />

      <header className="mb-10 text-center">
        <InteractiveTitle
          text="Highlights"
          variant="page"
          className="text-4xl md:text-5xl"
        />
        <p className="mt-4 text-sm tracking-[0.2em] text-ink-muted">
          ECHOES FROM THE MARGINS
        </p>
        <button
          type="button"
          onClick={openAdd}
          className="interactive-btn mt-8 border border-[#c9a84c]/70 bg-[#c9a84c]/10 px-5 py-2 text-xs tracking-[0.28em] text-ink hover:bg-[#c9a84c]/20"
        >
          + ADD HIGHLIGHT
        </button>
      </header>

      <div className="space-y-10">
        {groups.map((group) => (
          <HighlightCard
            key={group.id}
            group={group}
            onEditGroup={openEditGroup}
            onDeleteGroup={(g) => setConfirm({ type: 'group', group: g })}
            onEditQuote={openEditQuote}
            onDeleteQuote={(g, quoteIndex) =>
              setConfirm({ type: 'quote', group: g, quoteIndex })
            }
          />
        ))}
      </div>

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/30 px-4 py-8 backdrop-blur-[2px] modal-backdrop">
            <div className="modal-panel my-auto max-h-[min(90vh,880px)] w-full max-w-lg overflow-y-auto border border-[#c9a84c]/40 bg-[#fcf7f4]/95 p-6 shadow-card md:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-light text-ink">
                  {modalTitle}
                </h2>
                <p className="mt-1 text-xs tracking-wider text-ink-muted">
                  {modalHint}
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
              {mode === 'edit-quote' ? (
                <label className="block">
                  <span className="mb-1.5 block text-xs tracking-widest text-ink-muted">
                    摘抄内容 *
                  </span>
                  <textarea
                    value={singleQuote}
                    onChange={(e) => setSingleQuote(e.target.value)}
                    rows={5}
                    className="w-full resize-y border border-ink/15 bg-white/50 px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-[#c9a84c]/70"
                  />
                </label>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-xs tracking-widest text-ink-muted">
                      书名 / 文章标题 *
                    </span>
                    <input
                      value={bookTitle}
                      onChange={(e) => setBookTitle(e.target.value)}
                      placeholder="必填"
                      className="w-full border border-ink/15 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-[#c9a84c]/70"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs tracking-widest text-ink-muted">
                      作者
                    </span>
                    <input
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="可选"
                      className="w-full border border-ink/15 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-[#c9a84c]/70"
                    />
                  </label>

                  <div className="space-y-3">
                    <span className="block text-xs tracking-widest text-ink-muted">
                      摘抄金句 *
                    </span>
                    {quotes.map((quote, index) => (
                      <div key={index} className="flex gap-2">
                        <textarea
                          value={quote}
                          onChange={(e) => updateQuote(index, e.target.value)}
                          rows={3}
                          placeholder={`第 ${index + 1} 句`}
                          className="w-full resize-y border border-ink/15 bg-white/50 px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-[#c9a84c]/70"
                        />
                        {quotes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuoteField(index)}
                            className="shrink-0 self-start px-2 text-ink-muted transition hover:text-ink"
                            aria-label="删除这句"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addQuoteField}
                      className="text-xs tracking-widest text-[#9a7b2f] transition hover:text-ink"
                    >
                      + 再加一句
                    </button>
                  </div>
                </>
              )}

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
                  {pending
                    ? '保存中…'
                    : mode === 'add'
                      ? '确认添加'
                      : '保存修改'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {confirm && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/30 px-4 py-8 backdrop-blur-[2px] modal-backdrop">
            <div className="modal-panel my-auto w-full max-w-sm border border-[#c9a84c]/40 bg-[#fcf7f4]/95 p-6 shadow-card">
            <h2 className="font-display text-xl font-light text-ink">
              {confirm.type === 'group' ? '删除整组摘抄？' : '删除这句话？'}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              {confirm.type === 'group'
                ? `将移除「${confirm.group.bookTitle}」及其全部句子，此操作不可撤销。`
                : confirm.group.quotes.length <= 1
                  ? '这是最后一句，删除后整组摘抄也会一并移除。'
                  : '仅删除这一句，其余句子会保留。'}
            </p>
            {confirm.type === 'quote' && (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-light">
                “{confirm.group.quotes[confirm.quoteIndex]}”
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-xs tracking-widest text-ink-muted transition hover:text-ink"
              >
                取消
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleConfirmDelete}
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
