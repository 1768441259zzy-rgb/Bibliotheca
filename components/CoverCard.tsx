import Image from 'next/image';
import type { DragEvent } from 'react';
import type { BookCover } from '@/data/content';

interface CoverCardProps {
  cover: BookCover;
  onEdit?: (cover: BookCover) => void;
  onDelete?: (cover: BookCover) => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: DragEvent) => void;
  onDragEnd?: () => void;
}

export default function CoverCard({
  cover,
  onEdit,
  onDelete,
  onMoveLeft,
  onMoveRight,
  canMoveLeft,
  canMoveRight,
  draggable,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: CoverCardProps) {
  // Supabase Storage 等外链走直链，避免 Workers/边缘上的图片优化代理拦掉
  const isRemote = /^https?:\/\//i.test(cover.imageUrl);

  return (
    <article
      draggable={Boolean(draggable)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group relative break-inside-avoid overflow-hidden rounded-sm bg-white/30 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-card-hover ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-45 scale-[0.98]' : ''} ${
        isDragOver ? 'ring-2 ring-[#c9a84c]/70 ring-offset-2 ring-offset-[#fcf7f4]' : ''
      }`}
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <Image
          src={cover.imageUrl}
          alt={cover.title ?? 'Book cover'}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, 200px"
          unoptimized={isRemote}
          className="pointer-events-none object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />

        {(onMoveLeft || onMoveRight) && (
          <div className="absolute left-2 top-2 z-20 flex gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-300 sm:group-hover:opacity-100">
            <button
              type="button"
              disabled={!canMoveLeft}
              onClick={(e) => {
                e.stopPropagation();
                onMoveLeft?.();
              }}
              className="border border-white/40 bg-ink/55 px-1.5 py-1 text-[10px] text-white backdrop-blur-sm transition hover:bg-ink/75 disabled:opacity-30"
              aria-label="前移"
            >
              ←
            </button>
            <button
              type="button"
              disabled={!canMoveRight}
              onClick={(e) => {
                e.stopPropagation();
                onMoveRight?.();
              }}
              className="border border-white/40 bg-ink/55 px-1.5 py-1 text-[10px] text-white backdrop-blur-sm transition hover:bg-ink/75 disabled:opacity-30"
              aria-label="后移"
            >
              →
            </button>
          </div>
        )}

        {(onEdit || onDelete) && (
          <div className="absolute right-2 top-2 z-20 flex gap-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(cover);
                }}
                className="border border-white/40 bg-ink/55 px-2 py-1 text-[10px] tracking-wider text-white backdrop-blur-sm transition hover:bg-ink/75"
                aria-label="编辑封面"
              >
                编辑
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(cover);
                }}
                className="border border-white/40 bg-ink/55 px-2 py-1 text-[10px] tracking-wider text-white backdrop-blur-sm transition hover:bg-red-900/70"
                aria-label="删除封面"
              >
                删除
              </button>
            )}
          </div>
        )}

        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink/75 via-ink/20 to-transparent p-3 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          {cover.title && (
            <h3 className="text-sm font-medium leading-snug text-white md:text-base">
              {cover.title}
            </h3>
          )}
          {cover.designer && (
            <p className="mt-1 text-xs text-white/85">{cover.designer}</p>
          )}
          {cover.tags && cover.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {cover.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] tracking-wide text-white/90 backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
