'use client';

import { useEffect, useRef, useState } from 'react';

interface NoteComposerProps {
  quote: string;
  initialNote?: string;
  onCancel: () => void;
  onSave: (note: string) => void;
}

export default function NoteComposer({
  quote,
  initialNote = '',
  onCancel,
  onSave,
}: NoteComposerProps) {
  const [note, setNote] = useState(initialNote);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#1a1410]/45 px-4 backdrop-blur-[2px]">
      <div
        className="w-full max-w-md border border-[#c9a84c]/40 bg-[#f7efe4] p-5 shadow-[0_16px_40px_rgba(40,30,24,0.35)]"
        role="dialog"
        aria-label="添加阅读感悟"
      >
        <p className="font-display text-lg tracking-wide text-[#5c4033]">
          添加笔记
        </p>
        <p className="mt-3 max-h-24 overflow-y-auto border-l-2 border-[#c9a84c]/55 pl-3 text-sm leading-relaxed text-[#6b4f3f]">
          “{quote}”
        </p>
        <textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="写下这一刻的感悟…"
          className="mt-4 w-full resize-none border border-[#8c6d58]/25 bg-[#fdfbf7] px-3 py-2.5 text-sm leading-relaxed text-[#4a372e] outline-none focus:border-[#c9a84c]/55"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border border-[#8c6d58]/25 px-3 py-1.5 text-[10px] tracking-[0.18em] text-[#8c6d58]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(note.trim())}
            className="border border-[#c9a84c]/65 bg-[#c9a84c]/18 px-3 py-1.5 text-[10px] tracking-[0.18em] text-[#5c4033]"
          >
            保存便笺
          </button>
        </div>
      </div>
    </div>
  );
}
