'use client';

import { useEffect, useState } from 'react';
import type { HighlightGroup } from '@/data/content';
import ModalPortal from '@/components/ModalPortal';

interface FloatingSideIndexProps {
  groups: HighlightGroup[];
}

export default function FloatingSideIndex({ groups }: FloatingSideIndexProps) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(groups[0]?.id ?? null);

  useEffect(() => {
    if (groups.length === 0) {
      setActiveId(null);
      return;
    }

    const elements = groups
      .map((g) => document.getElementById(`highlight-${g.id}`))
      .filter((el): el is HTMLElement => !!el);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top)
          );
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id.replace(/^highlight-/, ''));
        }
      },
      {
        rootMargin: '-18% 0px -58% 0px',
        threshold: [0, 0.15, 0.4],
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [groups]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function scrollToGroup(id: string) {
    const el = document.getElementById(`highlight-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
    setOpen(false);
  }

  if (groups.length === 0) return null;

  return (
    <ModalPortal>
      {/* 点击外部收起 */}
      <button
        type="button"
        aria-label="关闭目录"
        className={`fixed inset-0 z-[70] bg-ink/15 backdrop-blur-[1px] transition-opacity duration-500 ${
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
      />

      <div
        className={`fixed top-1/2 left-0 z-[80] flex -translate-y-1/2 items-stretch transition-transform duration-700 ease-[cubic-bezier(0.33,1,0.32,1)] ${
          open ? 'translate-x-0' : 'translate-x-[calc(-100%+2.35rem)]'
        }`}
      >
        {/* 目录面板 */}
        <aside
          id="highlights-side-index"
          className="flex w-[min(18rem,78vw)] flex-col border-y border-r border-double border-[#8c6d58] bg-[#fdfbf7]/95 shadow-card backdrop-blur-md"
          aria-hidden={!open}
        >
          <header className="flex items-center justify-between border-b border-[#8c6d58]/25 px-5 py-4">
            <div>
              <p className="font-display text-sm tracking-[0.28em] text-[#6b4f3f]">
                INDEX
              </p>
              <p className="mt-1 text-[10px] tracking-[0.2em] text-ink-muted">
                HIGHLIGHTS
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-ink-muted transition-colors duration-300 hover:text-[#8b3a2a]"
              aria-label="关闭目录"
            >
              ✕
            </button>
          </header>

          <nav className="max-h-[min(70vh,32rem)] overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
            <ul className="space-y-1">
              {groups.map((group) => {
                const active = activeId === group.id;
                return (
                  <li key={group.id}>
                    <button
                      type="button"
                      onClick={() => scrollToGroup(group.id)}
                      className={`side-index-item group/item relative flex w-full items-start gap-2 px-3 py-2.5 text-left transition-all duration-500 ${
                        active ? 'bg-[#8c6d58]/8' : 'hover:bg-[#8c6d58]/6'
                      }`}
                    >
                      <span
                        className="side-index-ornament mt-1.5 shrink-0 text-[9px] text-[#8b3a2a]/0 transition-all duration-500 group-hover/item:translate-x-0 group-hover/item:text-[#8b3a2a]/80"
                        aria-hidden="true"
                      >
                        ❧
                      </span>
                      <span
                        className={`font-display text-[13px] leading-snug transition-colors duration-500 ${
                          active
                            ? 'text-[#8b3a2a]'
                            : 'text-ink-light group-hover/item:text-[#8b3a2a]'
                        }`}
                      >
                        《{group.bookTitle}》
                        {group.author ? ` ${group.author}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <footer className="border-t border-[#8c6d58]/20 px-5 py-3">
            <p className="text-[9px] tracking-[0.22em] text-ink-muted/80">
              {groups.length} ENTRIES
            </p>
          </footer>
        </aside>

        {/* 复古书签标签 */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="highlights-side-index"
          className="group relative flex w-[2.35rem] shrink-0 items-center justify-center self-start border-y border-r border-[#8c6d58] bg-[#f4ebe0]/95 py-8 shadow-card backdrop-blur-md transition-colors duration-500 hover:bg-[#efe4d6]"
          style={{
            borderTopRightRadius: '0.15rem',
            borderBottomRightRadius: '0.15rem',
            writingMode: 'vertical-rl',
          }}
        >
          <span
            className="pointer-events-none absolute inset-y-2 left-1 w-px bg-[#8c6d58]/25"
            aria-hidden="true"
          />
          <span className="font-display text-[11px] tracking-[0.35em] text-[#6b4f3f] transition-colors duration-500 group-hover:text-[#8b3a2a]">
            INDEX
          </span>
          <span
            className="pointer-events-none absolute inset-y-2 right-0 w-px bg-[#c9a84c]/45"
            aria-hidden="true"
          />
        </button>
      </div>
    </ModalPortal>
  );
}
