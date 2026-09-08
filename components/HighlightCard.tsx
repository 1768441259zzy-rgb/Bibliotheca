'use client';

import { useEffect, useRef, useState } from 'react';
import type { HighlightGroup } from '@/data/content';

interface HighlightCardProps {
  group: HighlightGroup;
  index?: number;
  onEditGroup?: (group: HighlightGroup) => void;
  onDeleteGroup?: (group: HighlightGroup) => void;
  onEditQuote?: (group: HighlightGroup, quoteIndex: number) => void;
  onDeleteQuote?: (group: HighlightGroup, quoteIndex: number) => void;
}

export default function HighlightCard({
  group,
  index = 0,
  onEditGroup,
  onDeleteGroup,
  onEditQuote,
  onDeleteQuote,
}: HighlightCardProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <article
      ref={ref}
      id={`highlight-${group.id}`}
      style={{ ['--i' as string]: index }}
      className={`highlight-card group scroll-mt-24 rounded-sm border border-white/70 bg-white/55 p-4 shadow-card backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.33,1,0.32,1)] hover:-translate-y-1 hover:border-[#c9a84c]/35 hover:shadow-card-hover sm:p-6 md:scroll-mt-28 md:p-10 ${
        visible ? 'is-visible' : ''
      }`}
    >
      <header className="mb-5 flex items-start justify-between gap-3 border-b border-ink/10 pb-4 sm:mb-8 sm:gap-4 sm:pb-6">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-medium leading-snug text-ink sm:text-2xl md:text-3xl">
            {group.bookTitle}
          </h2>
          {group.author && (
            <p className="mt-1.5 text-xs tracking-widest text-ink-muted sm:mt-2 sm:text-sm">
              — {group.author}
            </p>
          )}
        </div>

        {(onEditGroup || onDeleteGroup) && (
          <div className="flex shrink-0 gap-1.5">
            {onEditGroup && (
              <button
                type="button"
                onClick={() => onEditGroup(group)}
                className="border border-ink/15 bg-white/40 px-2 py-1 text-[10px] tracking-wider text-ink-muted transition hover:border-[#c9a84c]/50 hover:text-ink"
              >
                编辑
              </button>
            )}
            {onDeleteGroup && (
              <button
                type="button"
                onClick={() => onDeleteGroup(group)}
                className="border border-ink/15 bg-white/40 px-2 py-1 text-[10px] tracking-wider text-ink-muted transition hover:border-red-800/30 hover:text-red-900/80"
              >
                删除
              </button>
            )}
          </div>
        )}
      </header>

      <div className="space-y-6 sm:space-y-8">
        {group.quotes.map((quote, quoteIndex) => (
          <div
            key={`${group.id}-${quoteIndex}`}
            className="group/quote relative border-l-2 border-parchment-400/80 pl-3 transition-[border-color] duration-500 group-hover:border-[#c9a84c]/70 sm:pl-6"
          >
            {(onEditQuote || onDeleteQuote) && (
              <div className="mb-2 flex justify-end gap-1.5 sm:absolute sm:right-0 sm:top-0 sm:z-10 sm:mb-0 sm:opacity-0 sm:transition-opacity sm:duration-300 sm:group-hover/quote:opacity-100">
                {onEditQuote && (
                  <button
                    type="button"
                    onClick={() => onEditQuote(group, quoteIndex)}
                    className="border border-ink/15 bg-[#fcf7f4]/90 px-2 py-1 text-[10px] tracking-wider text-ink-muted transition hover:border-[#c9a84c]/50 hover:text-ink"
                  >
                    编辑
                  </button>
                )}
                {onDeleteQuote && (
                  <button
                    type="button"
                    onClick={() => onDeleteQuote(group, quoteIndex)}
                    className="border border-ink/15 bg-[#fcf7f4]/90 px-2 py-1 text-[10px] tracking-wider text-ink-muted transition hover:border-red-800/30 hover:text-red-900/80"
                  >
                    删除
                  </button>
                )}
              </div>
            )}
            <p className="break-words whitespace-pre-line text-[15px] leading-[1.85] text-ink-light sm:text-base sm:leading-[1.9] md:pr-20 md:text-lg">
              {quote}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
