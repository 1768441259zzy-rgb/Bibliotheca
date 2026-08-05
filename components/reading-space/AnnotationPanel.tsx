'use client';

import { useState } from 'react';
import type { ReadingAnnotation } from '@/lib/reading/annotations';
import { formatAnnotationDate } from '@/lib/reading/annotations';

interface AnnotationPanelProps {
  annotations: ReadingAnnotation[];
  onEditNote: (ann: ReadingAnnotation) => void;
  onRemove: (id: string) => void;
  onImport: (ann: ReadingAnnotation) => void;
  onJump: (chapterIndex: number) => void;
  /** 紧凑抽屉：默认收起，不占阅读高度 */
  compact?: boolean;
}

export default function AnnotationPanel({
  annotations,
  onEditNote,
  onRemove,
  onImport,
  onJump,
  compact = false,
}: AnnotationPanelProps) {
  const [open, setOpen] = useState(false);

  if (compact) {
    return (
      <aside className="annotation-panel border-t border-[#8c6d58]/15 bg-[#fdfbf7]/50 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left"
        >
          <span className="font-serif text-[10px] tracking-[0.18em] text-[#8c6d58]">
            感悟便笺{annotations.length ? ` · ${annotations.length}` : ''}
          </span>
          <span className="font-serif text-[9px] tracking-widest text-[#8c6d58]/80">
            {open ? '收起' : '展开'}
          </span>
        </button>
        {open && (
          <div className="max-h-28 overflow-y-auto border-t border-[#8c6d58]/10 px-3 pb-2 pt-1.5">
            {annotations.length === 0 ? (
              <p className="font-serif text-[11px] leading-relaxed text-[#8c6d58]/90">
                选中文字后可高亮、记笔记，或导入 Highlights。
              </p>
            ) : (
              <div className="annotation-slips flex gap-2 overflow-x-auto pb-0.5">
                {annotations.map((ann) => (
                  <AnnotationSlip
                    key={ann.id}
                    ann={ann}
                    onEditNote={onEditNote}
                    onRemove={onRemove}
                    onImport={onImport}
                    onJump={onJump}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    );
  }

  if (annotations.length === 0) {
    return (
      <aside className="annotation-panel border border-[#8c6d58]/15 bg-[#fdfbf7]/40 px-4 py-3 backdrop-blur-sm">
        <p className="font-serif text-[10px] tracking-[0.22em] text-[#8c6d58]">
          感悟便笺
        </p>
        <p className="mt-1.5 font-serif text-xs leading-relaxed text-[#8c6d58]/90">
          选中文字后，可高亮、记笔记，或导入到 Highlights。
        </p>
      </aside>
    );
  }

  return (
    <aside className="annotation-panel">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <p className="font-serif text-[10px] tracking-[0.22em] text-[#8c6d58]">
          感悟便笺 · {annotations.length}
        </p>
      </div>
      <div className="annotation-slips flex gap-3 overflow-x-auto pb-1">
        {annotations.map((ann) => (
          <AnnotationSlip
            key={ann.id}
            ann={ann}
            onEditNote={onEditNote}
            onRemove={onRemove}
            onImport={onImport}
            onJump={onJump}
          />
        ))}
      </div>
    </aside>
  );
}

function AnnotationSlip({
  ann,
  onEditNote,
  onRemove,
  onImport,
  onJump,
}: {
  ann: ReadingAnnotation;
  onEditNote: (ann: ReadingAnnotation) => void;
  onRemove: (id: string) => void;
  onImport: (ann: ReadingAnnotation) => void;
  onJump: (chapterIndex: number) => void;
}) {
  return (
    <article className="annotation-slip relative w-[14rem] shrink-0 border border-[#c9a84c]/35 bg-[#f7efe4] px-3 py-2.5 shadow-[2px_3px_0_rgba(92,64,51,0.08)]">
      <button
        type="button"
        onClick={() => onJump(ann.chapterIndex)}
        className="block w-full text-left"
      >
        <p className="line-clamp-2 text-[12px] leading-relaxed text-[#5c4033]">
          “{ann.quote}”
        </p>
        {ann.note ? (
          <p className="mt-1.5 line-clamp-2 border-t border-[#8c6d58]/15 pt-1.5 text-[11px] leading-relaxed text-[#6b4f3f]">
            {ann.note}
          </p>
        ) : null}
        <p className="mt-1.5 text-[9px] tracking-[0.14em] text-[#8c6d58]/75">
          {ann.chapterTitle} · {formatAnnotationDate(ann.createdAt)}
          {ann.synced ? ' · 已同步' : ''}
        </p>
      </button>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onEditNote(ann)}
          className="border border-[#8c6d58]/25 px-1.5 py-0.5 text-[9px] tracking-wider text-[#6b4f3f]"
        >
          笔记
        </button>
        <button
          type="button"
          onClick={() => onImport(ann)}
          disabled={ann.synced}
          className="border border-[#c9a84c]/45 px-1.5 py-0.5 text-[9px] tracking-wider text-[#5c4033] disabled:opacity-40"
        >
          {ann.synced ? '已导入' : '导入'}
        </button>
        <button
          type="button"
          onClick={() => onRemove(ann.id)}
          className="border border-[#8c6d58]/20 px-1.5 py-0.5 text-[9px] tracking-wider text-[#a07060]"
        >
          删除
        </button>
      </div>
    </article>
  );
}
