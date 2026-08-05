'use client';

interface SelectionMenuProps {
  x: number;
  y: number;
  onHighlight: () => void;
  onAddNote: () => void;
  onImport: () => void;
  importing?: boolean;
}

export default function SelectionMenu({
  x,
  y,
  onHighlight,
  onAddNote,
  onImport,
  importing,
}: SelectionMenuProps) {
  return (
    <div
      className="selection-popup fixed z-[90] flex -translate-x-1/2 items-center gap-0.5 border border-[#8c6d58]/50 bg-[#2c1d11]/90 px-1.5 py-1.5 text-[#f5e8c7] shadow-xl backdrop-blur-md"
      style={{ left: x, top: y }}
      role="menu"
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={onHighlight}
        className="whitespace-nowrap px-2.5 py-1.5 font-serif text-[11px] tracking-[0.08em] text-[#f5e8c7] transition hover:bg-[#f5e8c7]/12 hover:text-[#fff6df]"
      >
        🖍️ 高亮
      </button>
      <span className="h-3.5 w-px bg-[#8c6d58]/45" aria-hidden="true" />
      <button
        type="button"
        role="menuitem"
        onClick={onAddNote}
        className="whitespace-nowrap px-2.5 py-1.5 font-serif text-[11px] tracking-[0.08em] text-[#f5e8c7] transition hover:bg-[#f5e8c7]/12 hover:text-[#fff6df]"
      >
        📝 添加笔记
      </button>
      <span className="h-3.5 w-px bg-[#8c6d58]/45" aria-hidden="true" />
      <button
        type="button"
        role="menuitem"
        disabled={importing}
        onClick={onImport}
        className="whitespace-nowrap px-2.5 py-1.5 font-serif text-[11px] tracking-[0.08em] text-[#f0d78c] transition hover:bg-[#f5e8c7]/12 hover:text-[#fff6df] disabled:opacity-50"
      >
        {importing ? '导入中…' : '✦ 导入 Highlights'}
      </button>
      <span className="selection-popup-caret" aria-hidden="true" />
    </div>
  );
}
