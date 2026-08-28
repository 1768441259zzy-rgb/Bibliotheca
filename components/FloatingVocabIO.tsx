'use client';

import { useEffect, useState } from 'react';
import ModalPortal from '@/components/ModalPortal';

export type VocabExportFormat = 'excel' | 'word' | 'pdf' | 'csv' | 'json';

interface FloatingVocabIOProps {
  count: number;
  pending?: boolean;
  canExport?: boolean;
  onExport: (format: VocabExportFormat) => void;
  onImport: () => void;
}

const EXPORT_OPTIONS: {
  format: VocabExportFormat;
  label: string;
  hint: string;
}[] = [
  { format: 'excel', label: 'Excel', hint: '.xlsx' },
  { format: 'word', label: 'Word', hint: '.docx' },
  { format: 'pdf', label: 'PDF', hint: '打印另存' },
  { format: 'csv', label: 'CSV', hint: '表格' },
  { format: 'json', label: 'JSON', hint: '完整备份' },
];

export default function FloatingVocabIO({
  count,
  pending = false,
  canExport = true,
  onExport,
  onImport,
}: FloatingVocabIOProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <ModalPortal>
      <button
        type="button"
        aria-label="关闭导入导出"
        className={`fixed inset-0 z-[70] bg-ink/15 backdrop-blur-[1px] transition-opacity duration-500 ${
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
      />

      <div
        className={`fixed top-[min(58%,24rem)] left-0 z-[80] flex -translate-y-1/2 items-stretch transition-transform duration-700 ease-[cubic-bezier(0.33,1,0.32,1)] sm:top-[56%] ${
          open
            ? 'translate-x-0'
            : 'translate-x-[calc(-100%+2.15rem)] sm:translate-x-[calc(-100%+2.6rem)]'
        }`}
      >
        <aside
          id="vocab-side-io"
          className="flex w-[min(17.5rem,84vw)] flex-col border-y border-r border-double border-[#8c6d58] bg-[#fdfbf7]/95 shadow-card backdrop-blur-md sm:w-[min(18.5rem,78vw)]"
          aria-hidden={!open}
        >
          <header className="flex items-center justify-between border-b border-[#8c6d58]/25 px-5 py-4">
            <div>
              <p className="font-display text-[15px] tracking-[0.28em] text-[#6b4f3f]">
                FILE
              </p>
              <p className="mt-1 text-[10px] tracking-[0.2em] text-ink-muted">
                VOCABULARY
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-ink-muted transition-colors duration-300 hover:text-[#8b3a2a]"
              aria-label="关闭"
            >
              ✕
            </button>
          </header>

          <div className="px-3 py-4">
            <p className="mb-2 px-2 text-[9px] tracking-[0.22em] text-ink-muted">
              导出
            </p>
            <ul className="space-y-1">
              {EXPORT_OPTIONS.map((opt) => (
                <li key={opt.format}>
                  <button
                    type="button"
                    disabled={!canExport || pending}
                    onClick={() => {
                      onExport(opt.format);
                      setOpen(false);
                    }}
                    className="group/item flex w-full items-baseline justify-between gap-2 px-3 py-2.5 text-left transition-all duration-500 hover:bg-[#8c6d58]/6 disabled:opacity-40"
                  >
                    <span className="font-display text-[14px] text-ink-light transition-colors duration-500 group-hover/item:text-[#8b3a2a]">
                      {opt.label}
                    </span>
                    <span className="text-[10px] tracking-wider text-ink-muted">
                      {opt.hint}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="my-3 border-t border-[#8c6d58]/15" />

            <button
              type="button"
              disabled={pending}
              onClick={() => {
                onImport();
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-all duration-500 hover:bg-[#8c6d58]/6 disabled:opacity-40"
            >
              <span className="font-display text-[14px] text-ink-light">
                {pending ? '导入中…' : '导入'}
              </span>
              <span className="text-[10px] tracking-wider text-ink-muted">
                Excel / Word
              </span>
            </button>
          </div>

          <footer className="mt-auto border-t border-[#8c6d58]/20 px-5 py-3">
            <p className="text-[9px] tracking-[0.22em] text-ink-muted/80">
              {count} ENTRIES
            </p>
          </footer>
        </aside>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="vocab-side-io"
          className="group relative flex w-[2.15rem] shrink-0 items-center justify-center self-start border-y border-r border-[#8c6d58] bg-[#f4ebe0]/95 py-7 shadow-card backdrop-blur-md transition-colors duration-500 hover:bg-[#efe4d6] sm:w-[2.6rem] sm:py-9"
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
          <span className="font-display text-[12px] tracking-[0.38em] text-[#6b4f3f] transition-colors duration-500 group-hover:text-[#8b3a2a] sm:text-[13px]">
            FILE
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
