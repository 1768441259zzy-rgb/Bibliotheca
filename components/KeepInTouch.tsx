'use client';

import { useState, useTransition } from 'react';
import InteractiveTitle from '@/components/InteractiveTitle';
import ModalPortal from '@/components/ModalPortal';
import GuestNoteWall, { type PublicNote } from '@/components/GuestNoteWall';

const CONTACT = {
  email: '13580537063@163.com',
  wechat: 'z1768441259',
};

const STAMPS = [
  { symbol: '✒', label: '羽笔' },
  { symbol: '✦', label: '烫金' },
  { symbol: '☙', label: '卷草' },
  { symbol: '☽', label: '夜读' },
  { symbol: '❖', label: '菱印' },
] as const;

export default function KeepInTouch() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [content, setContent] = useState('');
  const [stamp, setStamp] = useState<string>(STAMPS[0].symbol);
  const [error, setError] = useState('');
  const [sealedStamp, setSealedStamp] = useState<string | null>(null);
  const [copied, setCopied] = useState<'email' | 'wechat' | null>(null);
  const [pending, startTransition] = useTransition();
  const [wallKey, setWallKey] = useState(0);
  const [newestNote, setNewestNote] = useState<PublicNote | null>(null);

  async function copyText(value: string, key: 'email' | 'wechat') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError('复制失败，请手动选择复制');
    }
  }

  function resetForm() {
    setName('');
    setContact('');
    setContent('');
    setStamp(STAMPS[0].symbol);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSealedStamp(null);

    if (!name.trim() || !content.trim()) {
      setError('请填写名字与留言内容');
      return;
    }
    if (!stamp) {
      setError('请选择一枚藏书印');
      return;
    }

    const chosenStamp = stamp;

    startTransition(async () => {
      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            contact: contact.trim(),
            content: content.trim(),
            stamp: chosenStamp,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          stamp?: string;
          note?: PublicNote;
        };
        if (!res.ok) {
          setError(data.error || '发送失败');
          return;
        }
        resetForm();
        setSealedStamp(data.stamp || chosenStamp);
        if (data.note) {
          setNewestNote(data.note);
          setWallKey((k) => k + 1);
        }
      } catch {
        setError('网络异常，请稍后重试');
      }
    });
  }

  return (
    <>
      <section className="mt-16 w-full border-t border-ink/10 pt-12 text-left">
        <header className="mb-8 text-center">
          <InteractiveTitle
            text="Keep in Touch"
            as="h2"
            variant="section"
            className="text-3xl"
          />
          <p className="mt-3 text-sm tracking-[0.2em] text-ink-muted">
            LEAVE A NOTE · SAY HELLO
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs tracking-widest text-ink-muted">
                你的名字 *
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="怎么称呼你"
                className="w-full border border-ink/15 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-[#c9a84c]/70"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs tracking-widest text-ink-muted">
                联系方式
              </span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="邮箱 / 微信（可选）"
                className="w-full border border-ink/15 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-[#c9a84c]/70"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs tracking-widest text-ink-muted">
              留言 *
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="想说的话、书单推荐、合作邀约……"
              className="w-full resize-y border border-ink/15 bg-white/50 px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-[#c9a84c]/70"
            />
          </label>

          <div className="pt-1">
            <p className="mb-3 text-center text-[10px] tracking-[0.18em] text-ink-muted">
              选择一枚落款藏书印 / Select a stamp
            </p>
            <div
              className="flex flex-wrap items-center justify-center gap-3"
              role="radiogroup"
              aria-label="落款藏书印"
            >
              {STAMPS.map((item) => {
                const selected = stamp === item.symbol;
                return (
                  <button
                    key={item.symbol}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={item.label}
                    title={item.label}
                    onClick={() => setStamp(item.symbol)}
                    className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-500 ${
                      selected
                        ? 'scale-105 border-[1.5px] border-[#8b3a2a] bg-[radial-gradient(circle_at_35%_30%,#f3e2d4,#e8cfc0_55%,#d4b09a)] text-[#8b3a2a] shadow-[0_0_0_3px_rgba(139,58,42,0.12),0_2px_10px_rgba(139,58,42,0.18)]'
                        : 'border border-[#8c6d58]/35 bg-[linear-gradient(145deg,#fdfbf7,#f4ebe0)] text-[#8c6d58]/85 hover:border-[#8c6d58]/70 hover:text-[#6b4f3f]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none absolute inset-[3px] rounded-full border transition-opacity duration-500 ${
                        selected
                          ? 'border-[#8b3a2a]/45 opacity-100'
                          : 'border-[#8c6d58]/20 opacity-70'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="relative text-base leading-none">
                      {item.symbol}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-center text-sm text-red-700/80">{error}</p>
          )}

          <div className="flex flex-col items-center gap-5 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="interactive-btn border border-[#c9a84c]/70 bg-[#c9a84c]/15 px-6 py-2 text-xs tracking-[0.22em] text-ink hover:bg-[#c9a84c]/25 disabled:opacity-60"
            >
              {pending ? '盖印中…' : 'SEND NOTE'}
            </button>

            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => copyText(CONTACT.email, 'email')}
                title={
                  copied === 'email'
                    ? '已复制邮箱'
                    : `复制邮箱 ${CONTACT.email}`
                }
                aria-label="复制网易邮箱"
                className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-[#c9a84c]/55 bg-[linear-gradient(145deg,#f7f0e4,#efe2d0)] text-[#9a7b2f] shadow-[0_2px_8px_rgba(154,123,47,0.12)] transition duration-300 hover:-translate-y-0.5 hover:border-[#c9a84c]/90 hover:shadow-[0_4px_14px_rgba(154,123,47,0.2)]"
              >
                <MailWaxIcon />
              </button>

              <button
                type="button"
                onClick={() => copyText(CONTACT.wechat, 'wechat')}
                title={
                  copied === 'wechat'
                    ? '已复制微信号'
                    : `复制微信 ${CONTACT.wechat}`
                }
                aria-label="复制微信号"
                className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-[#c9a84c]/55 bg-[linear-gradient(145deg,#f7f0e4,#efe2d0)] text-[#9a7b2f] shadow-[0_2px_8px_rgba(154,123,47,0.12)] transition duration-300 hover:-translate-y-0.5 hover:border-[#c9a84c]/90 hover:shadow-[0_4px_14px_rgba(154,123,47,0.2)]"
              >
                <ChatSealIcon />
              </button>
            </div>

            {copied && (
              <p className="text-xs tracking-wider text-[#9a7b2f]">
                {copied === 'email' ? '邮箱已复制' : '微信号已复制'}
              </p>
            )}
          </div>
        </form>
      </section>

      <GuestNoteWall refreshKey={wallKey} newest={newestNote} />

      {sealedStamp && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30 px-4 py-8 backdrop-blur-[2px] modal-backdrop">
            <div className="modal-panel relative w-full max-w-sm border border-double border-[#8c6d58] bg-[#fdfbf7]/96 px-8 py-10 text-center shadow-card">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center">
                <div className="seal-stamp relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-[1.5px] border-[#8b3a2a]/80 bg-[radial-gradient(circle_at_35%_30%,#f3e2d4,#e0b9a0_50%,#c4896e)] text-[#8b3a2a] shadow-[0_0_0_4px_rgba(139,58,42,0.1),inset_0_1px_0_rgba(255,255,255,0.35)]">
                  <span
                    className="pointer-events-none absolute inset-[5px] rounded-full border border-[#8b3a2a]/40"
                    aria-hidden="true"
                  />
                  <span className="relative text-2xl leading-none">
                    {sealedStamp}
                  </span>
                </div>
              </div>
              <p className="font-display text-xl font-light text-ink">
                便签已盖印寄出
              </p>
              <p className="mt-2 text-xs tracking-[0.28em] text-ink-muted">
                SEALED & SENT
              </p>
              <button
                type="button"
                onClick={() => setSealedStamp(null)}
                className="interactive-btn mt-7 border border-[#8c6d58]/50 bg-[#8c6d58]/8 px-5 py-2 text-xs tracking-[0.2em] text-ink hover:bg-[#8c6d58]/15"
              >
                好的
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

function MailWaxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] transition group-hover:scale-105"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="6" width="17" height="12" rx="1.2" />
      <path d="M3.8 7.2 12 13.2 20.2 7.2" />
      <circle
        cx="12"
        cy="15.6"
        r="1.1"
        fill="currentColor"
        stroke="none"
        opacity="0.75"
      />
    </svg>
  );
}

function ChatSealIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] transition group-hover:scale-105"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 8.2c0-2.1 2.3-3.8 5.2-3.8s5.2 1.7 5.2 3.8-2.3 3.8-5.2 3.8c-.5 0-1-.05-1.4-.15L6.2 13.2 6.7 11.2C5.6 10.4 5 9.3 5 8.2Z" />
      <path d="M13.2 11.6c2.4.3 4.3 1.7 4.3 3.5 0 .8-.4 1.6-1.1 2.2l.3 1.4-1.6-.8c-.4.1-.8.15-1.2.15-1.8 0-3.3-.8-4-1.9" />
      <circle cx="8.6" cy="8.1" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="11.6" cy="8.1" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}
