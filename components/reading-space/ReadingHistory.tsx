'use client';

import { useState } from 'react';
import type { ReadingSessionMeta } from '@/lib/reading/readingStore';
import { formatAnnotationDate } from '@/lib/reading/annotations';

interface ReadingHistoryProps {
  sessions: ReadingSessionMeta[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  /** 紧凑抽屉：默认收起 */
  compact?: boolean;
}

export default function ReadingHistory({
  sessions,
  activeId,
  onOpen,
  onRemove,
  compact = false,
}: ReadingHistoryProps) {
  const [open, setOpen] = useState(false);

  if (compact) {
    return (
      <div className="border-t border-[#8c6d58]/15 bg-[#fdfbf7]/50 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left"
        >
          <span className="font-serif text-[10px] tracking-[0.18em] text-[#8c6d58]">
            阅读记录{sessions.length ? ` · ${sessions.length}` : ''}
          </span>
          <span className="font-serif text-[9px] tracking-widest text-[#8c6d58]/80">
            {open ? '收起' : '展开'}
          </span>
        </button>
        {open && (
          <div className="max-h-28 overflow-y-auto border-t border-[#8c6d58]/10 px-3 pb-2 pt-1.5">
            {sessions.length === 0 ? (
              <p className="font-serif text-[11px] text-[#8c6d58]/85">
                打开书卷后会自动保存在此。
              </p>
            ) : (
              <ul className="space-y-1">
                {sessions.map((s) => {
                  const active = s.id === activeId;
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center gap-2 border px-2 py-1 ${
                        active
                          ? 'border-[#8b3a2a]/40 bg-[#8b3a2a]/08'
                          : 'border-[#8c6d58]/15 bg-[#fdfbf7]/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onOpen(s.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate font-display text-[12px] text-[#5c4033]">
                          {s.title}
                        </span>
                        <span className="mt-0.5 block font-serif text-[9px] tracking-wider text-[#8c6d58]">
                          {s.format.toUpperCase()} · 第{' '}
                          {(s.chapterIndex ?? 0) + 1}{' '}
                          {s.format === 'pdf' ? '页' : '章'} ·{' '}
                          {formatAnnotationDate(s.updatedAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        title="删除记录"
                        onClick={() => onRemove(s.id)}
                        className="shrink-0 border border-[#8c6d58]/20 px-1.5 py-0.5 font-serif text-[9px] text-[#a07060]"
                      >
                        删
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="border border-[#8c6d58]/15 bg-[#fdfbf7]/35 px-3 py-2.5 backdrop-blur-sm">
        <p className="font-serif text-[10px] tracking-[0.2em] text-[#8c6d58]">
          阅读记录
        </p>
        <p className="mt-1 font-serif text-[11px] text-[#8c6d58]/85">
          打开书卷后会自动保存在此，换书或离开页面也不会丢失。
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[#8c6d58]/15 bg-[#fdfbf7]/35 px-3 py-2.5 backdrop-blur-sm">
      <p className="mb-2 font-serif text-[10px] tracking-[0.2em] text-[#8c6d58]">
        阅读记录 · {sessions.length}
      </p>
      <ul className="max-h-36 space-y-1.5 overflow-y-auto">
        {sessions.map((s) => {
          const active = s.id === activeId;
          return (
            <li
              key={s.id}
              className={`flex items-center gap-2 border px-2 py-1.5 ${
                active
                  ? 'border-[#8b3a2a]/40 bg-[#8b3a2a]/08'
                  : 'border-[#8c6d58]/15 bg-[#fdfbf7]/40'
              }`}
            >
              <button
                type="button"
                onClick={() => onOpen(s.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate font-display text-[12px] text-[#5c4033]">
                  {s.title}
                </span>
                <span className="mt-0.5 block font-serif text-[9px] tracking-wider text-[#8c6d58]">
                  {s.format.toUpperCase()} · 第 {(s.chapterIndex ?? 0) + 1}{' '}
                  {s.format === 'pdf' ? '页' : '章'} ·{' '}
                  {formatAnnotationDate(s.updatedAt)}
                </span>
              </button>
              <button
                type="button"
                title="删除记录"
                onClick={() => onRemove(s.id)}
                className="shrink-0 border border-[#8c6d58]/20 px-1.5 py-0.5 font-serif text-[9px] text-[#a07060]"
              >
                删
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
