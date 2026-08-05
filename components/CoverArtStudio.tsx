'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { BookCover } from '@/data/content';
import CoverCard from '@/components/CoverCard';
import GoldFiligreeFrame from '@/components/GoldFiligreeFrame';
import InteractiveTitle from '@/components/InteractiveTitle';
import ModalPortal from '@/components/ModalPortal';

interface CoverArtStudioProps {
  initialCovers: BookCover[];
}

type ModalMode = 'add' | 'edit';

function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function CoverArtStudio({ initialCovers }: CoverArtStudioProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [covers, setCovers] = useState(initialCovers);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [designer, setDesigner] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [error, setError] = useState('');
  const [orderError, setOrderError] = useState('');
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<BookCover | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    setCovers(initialCovers);
  }, [initialCovers]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function persistOrder(next: BookCover[]) {
    setOrderError('');
    startTransition(async () => {
      try {
        const res = await fetch('/api/covers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: next.map((c) => c.id) }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setOrderError(data.error || '排序保存失败');
          setCovers(initialCovers);
          return;
        }
        router.refresh();
      } catch {
        setOrderError('排序保存失败，请稍后重试');
        setCovers(initialCovers);
      }
    });
  }

  function applyReorder(from: number, to: number) {
    setCovers((prev) => {
      const next = moveItem(prev, from, to);
      if (next === prev) return prev;
      queueMicrotask(() => persistOrder(next));
      return next;
    });
  }

  function resetForm() {
    setTitle('');
    setDesigner('');
    setTags('');
    setFile(null);
    setError('');
    setEditingId(null);
    setExistingImageUrl('');
    setMode('add');
    if (fileRef.current) fileRef.current.value = '';
  }

  function openAdd() {
    resetForm();
    setMode('add');
    setOpen(true);
  }

  function openEdit(cover: BookCover) {
    setMode('edit');
    setEditingId(cover.id);
    setTitle(cover.title ?? '');
    setDesigner(cover.designer ?? '');
    setTags(cover.tags?.join(', ') ?? '');
    setFile(null);
    setExistingImageUrl(cover.imageUrl);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
    setOpen(true);
  }

  function onSelectFile(selected: File | null) {
    setError('');
    setFile(selected);
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (mode === 'add' && !file) {
      setError('请先选择一张封面图片');
      return;
    }

    const body = new FormData();
    if (mode === 'edit' && editingId) body.append('id', editingId);
    if (file) body.append('image', file);
    body.append('title', title);
    body.append('designer', designer);
    body.append('tags', tags);

    setError('');
    startTransition(async () => {
      try {
        const res = await fetch('/api/covers', {
          method: mode === 'edit' ? 'PATCH' : 'POST',
          body,
        });
        const data = (await res.json()) as { cover?: BookCover; error?: string };
        if (!res.ok || !data.cover) {
          setError(data.error || (mode === 'edit' ? '更新失败' : '上传失败'));
          return;
        }

        if (mode === 'edit') {
          setCovers((prev) =>
            prev.map((c) => (c.id === data.cover!.id ? data.cover! : c))
          );
        } else {
          setCovers((prev) => [...prev, data.cover!]);
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
        const res = await fetch(`/api/covers?id=${encodeURIComponent(target.id)}`, {
          method: 'DELETE',
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error || '删除失败');
          setConfirmDelete(null);
          return;
        }
        setCovers((prev) => prev.filter((c) => c.id !== target.id));
        setConfirmDelete(null);
        router.refresh();
      } catch {
        setError('网络异常，请稍后重试');
        setConfirmDelete(null);
      }
    });
  }

  function onCardDragStart(e: DragEvent, id: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/cover-id', id);
    setDraggingId(id);
  }

  function onCardDragOver(e: DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) setDragOverId(id);
  }

  function onCardDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/cover-id') || draggingId;
    setDraggingId(null);
    setDragOverId(null);
    if (!fromId || fromId === targetId) return;

    setCovers((prev) => {
      const from = prev.findIndex((c) => c.id === fromId);
      const to = prev.findIndex((c) => c.id === targetId);
      const next = moveItem(prev, from, to);
      if (next === prev) return prev;
      queueMicrotask(() => persistOrder(next));
      return next;
    });
  }

  const displayPreview = previewUrl || (mode === 'edit' ? existingImageUrl : '');

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-2 pt-2 sm:px-6">
      <header className="relative z-10 mb-8 text-center sm:mb-10">
        <InteractiveTitle
          text="Cover Art"
          variant="page"
          className="text-3xl sm:text-4xl md:text-5xl"
        />
        <p className="mt-3 text-[11px] tracking-[0.18em] text-ink-muted sm:mt-4 sm:text-sm sm:tracking-[0.2em]">
          A COLLECTION OF VINTAGE BINDINGS
        </p>
        <p className="mt-2 text-[10px] tracking-wider text-ink-muted/90 sm:mt-3 sm:text-xs">
          拖动封面可调整顺序 · 手机可用 ← →
        </p>
        <button
          type="button"
          onClick={openAdd}
          className="interactive-btn mt-5 border border-[#c9a84c]/70 bg-[#c9a84c]/10 px-5 py-2 text-xs tracking-[0.28em] text-ink hover:bg-[#c9a84c]/20 sm:mt-6"
        >
          + ADD COVER
        </button>
        {orderError && (
          <p className="mt-3 text-sm text-red-700/80">{orderError}</p>
        )}
      </header>

      <div className="relative px-2 py-4 sm:px-6 sm:py-8 md:px-8 md:py-10">
        <GoldFiligreeFrame />
        <div className="relative z-10 mx-auto grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4">
          {covers.map((cover, index) => (
            <CoverCard
              key={cover.id}
              cover={cover}
              onEdit={openEdit}
              onDelete={setConfirmDelete}
              canMoveLeft={index > 0}
              canMoveRight={index < covers.length - 1}
              onMoveLeft={() => applyReorder(index, index - 1)}
              onMoveRight={() => applyReorder(index, index + 1)}
              draggable
              isDragging={draggingId === cover.id}
              isDragOver={dragOverId === cover.id && draggingId !== cover.id}
              onDragStart={(e) => onCardDragStart(e, cover.id)}
              onDragOver={(e) => onCardDragOver(e, cover.id)}
              onDragLeave={() => {
                if (dragOverId === cover.id) setDragOverId(null);
              }}
              onDrop={(e) => onCardDrop(e, cover.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
            />
          ))}
        </div>
      </div>

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/30 px-4 py-8 backdrop-blur-[2px] modal-backdrop">
            <div className="modal-panel my-auto w-full max-w-md border border-[#c9a84c]/40 bg-[#fcf7f4]/95 p-6 shadow-card md:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-light text-ink">
                    {mode === 'edit' ? '编辑封面' : '导入新封面'}
                  </h2>
                  <p className="mt-1 text-xs tracking-wider text-ink-muted">
                    {mode === 'edit'
                      ? '可改信息，也可选新图替换'
                      : '上传图片并填写可选信息'}
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
                    封面图片 {mode === 'add' ? '*' : '（可选替换）'}
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-ink file:mr-3 file:border file:border-[#c9a84c]/50 file:bg-[#c9a84c]/10 file:px-3 file:py-1.5 file:text-xs file:tracking-wider file:text-ink"
                  />
                </label>

                {displayPreview && (
                  <div className="mx-auto w-28 overflow-hidden border border-ink/10 bg-white/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayPreview}
                      alt="预览"
                      className="aspect-[3/4] w-full object-cover"
                    />
                  </div>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-xs tracking-widest text-ink-muted">
                    书名 / 标题
                  </span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="可选"
                    className="w-full border border-ink/15 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-[#c9a84c]/70"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs tracking-widest text-ink-muted">
                    设计师 / 装帧师
                  </span>
                  <input
                    value={designer}
                    onChange={(e) => setDesigner(e.target.value)}
                    placeholder="可选"
                    className="w-full border border-ink/15 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-[#c9a84c]/70"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs tracking-widest text-ink-muted">
                    标签
                  </span>
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="用逗号分隔，如：精装, 复古"
                    className="w-full border border-ink/15 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-[#c9a84c]/70"
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
                    {pending
                      ? mode === 'edit'
                        ? '保存中…'
                        : '上传中…'
                      : mode === 'edit'
                        ? '保存修改'
                        : '确认导入'}
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
              <h2 className="font-display text-xl font-light text-ink">删除封面？</h2>
              <p className="mt-2 text-sm text-ink-muted">
                {confirmDelete.title
                  ? `将移除「${confirmDelete.title}」，此操作不可撤销。`
                  : '将移除这张封面，此操作不可撤销。'}
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
