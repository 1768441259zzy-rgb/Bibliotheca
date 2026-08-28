'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import ModalPortal from '@/components/ModalPortal';

interface VocabComposerProps {
  english: string;
  source?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

export default function VocabComposer({
  english,
  source,
  onCancel,
  onSaved,
}: VocabComposerProps) {
  const [zh, setZh] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      const res = await fetch('/api/vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          english,
          chinese: zh,
          source: source || undefined,
          mergeByEnglish: true,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        merged?: boolean;
      };
      if (!res.ok) {
        setError(data.error || '保存失败');
        setPending(false);
        return;
      }
      onSaved(data.merged ? '已更新词汇本中的同词条' : '已加入 Vocabulary');
    } catch {
      setError('网络异常，请稍后重试');
      setPending(false);
    }
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/35 px-4 py-8 backdrop-blur-[2px] modal-backdrop">
        <div className="modal-panel my-auto w-full max-w-md border border-[#8c6d58]/40 bg-[#fdfbf7]/95 p-6 shadow-card">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-light text-[#5c4033]">
                加入 Vocabulary
              </h2>
              <p className="mt-1 text-[11px] tracking-wider text-[#8c6d58]">
                英文已填入 · 请补充中文释义
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-[#8c6d58] transition hover:text-[#5c4033]"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[10px] tracking-[0.2em] text-[#8c6d58]">
                ENGLISH
              </span>
              <p className="border border-[#8c6d58]/20 bg-[#f7efe4]/50 px-3 py-2 font-serif text-sm text-[#5c4033]">
                {english}
              </p>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] tracking-[0.2em] text-[#8c6d58]">
                中文释义
              </span>
              <input
                value={zh}
                onChange={(e) => setZh(e.target.value)}
                autoFocus
                placeholder="手动输入中文（可留空稍后补）"
                className="w-full border border-[#8c6d58]/25 bg-white/60 px-3 py-2 text-sm text-[#5c4033] outline-none focus:border-[#c9a84c]/70"
              />
            </label>

            {source && (
              <p className="text-[10px] tracking-wider text-[#8c6d58]/85">
                来源 · {source}
              </p>
            )}

            {error && <p className="text-sm text-red-800/80">{error}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs tracking-widest text-[#8c6d58] transition hover:text-[#5c4033]"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={pending}
                className="interactive-btn border border-[#c9a84c]/70 bg-[#c9a84c]/15 px-5 py-2 text-xs tracking-[0.2em] text-[#5c4033] hover:bg-[#c9a84c]/25 disabled:opacity-60"
              >
                {pending ? '保存中…' : '确认加入'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
