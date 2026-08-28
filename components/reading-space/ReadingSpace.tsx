'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ParsedEbook } from '@/lib/reading/parseEbook';
import { READING_SCENES, type ReadingScene } from '@/lib/reading/scenes';
import ReaderPane from '@/components/reading-space/ReaderPane';
import VibeController from '@/components/reading-space/VibeController';
import {
  type BookSize,
  type ReadingPrefs,
  type ReadingSessionMeta,
  listSessions,
  patchPrefs,
  readPrefs,
} from '@/lib/reading/readingStore';
import {
  bootstrapReadingCloud,
  deleteReadingSessionEverywhere,
  ensureBookAvailable,
} from '@/lib/reading/readingCloudClient';

const SIZE_OPTIONS: { id: BookSize; label: string; title: string }[] = [
  { id: 'standard', label: '标准', title: '标准宽度' },
  { id: 'wide', label: '宽屏', title: '宽屏阅读' },
  { id: 'full', label: '⤢', title: '全屏模式' },
];

export default function ReadingSpace() {
  const [mounted, setMounted] = useState(false);
  const [prefs, setPrefs] = useState<ReadingPrefs | null>(null);
  const [book, setBook] = useState<ParsedEbook | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ReadingSessionMeta[]>([]);
  const [restoreHint, setRestoreHint] = useState<ReadingSessionMeta | null>(
    null
  );
  const [error, setError] = useState('');
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    setMounted(true);
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlHeight: html.style.height,
      bodyHeight: body.style.height,
    };
    html.classList.add('reading-space-lock');
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.height = '100%';
    return () => {
      html.classList.remove('reading-space-lock');
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      html.style.height = prev.htmlHeight;
      body.style.height = prev.bodyHeight;
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    async function boot() {
      const p = readPrefs();
      if (cancelled) return;
      setPrefs(p);

      let list = listSessions();
      try {
        list = await bootstrapReadingCloud();
      } catch (err) {
        console.warn('Reading cloud bootstrap failed:', err);
      }
      if (cancelled) return;
      setSessions(list);

      const lastId = p.lastSessionId ?? list[0]?.id ?? null;
      if (lastId) {
        try {
          const restored = await ensureBookAvailable(lastId);
          const meta = list.find((s) => s.id === lastId) ?? null;
          if (!cancelled && restored) {
            setBook(restored);
            setSessionId(lastId);
            setRestoreHint(meta);
            setBooting(false);
            return;
          }
        } catch (err) {
          console.error('Restore reading session failed:', err);
        }
      }
      if (!cancelled) setBooting(false);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const scene = prefs?.scene ?? 'sunroom';
  const bookSize = prefs?.bookSize ?? 'wide';
  const glassOpacity = prefs?.glassOpacity ?? 0.4;
  const isFull = bookSize === 'full';

  const setScene = useCallback((next: ReadingScene) => {
    setPrefs(patchPrefs({ scene: next }));
  }, []);

  const setBookSize = useCallback((next: BookSize) => {
    setPrefs(patchPrefs({ bookSize: next }));
  }, []);

  const setGlassOpacity = useCallback((next: number) => {
    setPrefs(patchPrefs({ glassOpacity: next }));
  }, []);

  const shellWidth =
    bookSize === 'standard'
      ? 'max-w-3xl'
      : bookSize === 'wide'
        ? 'max-w-5xl'
        : 'max-w-none';

  const refreshSessions = useCallback(() => {
    setSessions(listSessions());
  }, []);

  async function openSession(id: string) {
    setError('');
    setBooting(true);
    try {
      const restored = await ensureBookAvailable(id);
      if (!restored) {
        setError('找不到这份阅读记录，可能已被清除');
        setBooting(false);
        return;
      }
      const meta = listSessions().find((s) => s.id === id) ?? null;
      setBook(restored);
      setSessionId(id);
      setRestoreHint(meta);
      patchPrefs({ lastSessionId: id });
      refreshSessions();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : '打开阅读记录失败'
      );
    } finally {
      setBooting(false);
    }
  }

  async function deleteSession(id: string) {
    const list = await deleteReadingSessionEverywhere(id);
    setSessions(list);
    if (sessionId === id) {
      setBook(null);
      setSessionId(null);
      setRestoreHint(null);
    }
  }

  const sizeBar = (
    <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-sm border border-[#8c6d58]/35 bg-[#fdfbf7]/85 px-2.5 py-1.5 shadow-[0_8px_28px_rgba(61,47,42,0.18)] backdrop-blur-md">
      {SIZE_OPTIONS.map((opt) => {
        const active = bookSize === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            title={opt.title}
            onClick={() => setBookSize(opt.id)}
            className={`border px-2.5 py-1.5 font-serif text-[10px] tracking-wider transition-all duration-300 ${
              active
                ? 'border-[#8c6d58]/55 bg-[#f7efe4] text-[#4a3728]'
                : 'border-transparent text-[#6b4f3f] hover:border-[#8c6d58]/25 hover:bg-[#fdfbf7]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
      {isFull && (
        <button
          type="button"
          title="退出全屏"
          onClick={() => setBookSize('wide')}
          className="border border-[#8b3a2a]/40 bg-[#fdfbf7] px-2.5 py-1.5 font-serif text-[10px] tracking-wider text-[#8b3a2a] transition hover:bg-[#f7efe4]"
        >
          退出全屏
        </button>
      )}
      <span className="mx-0.5 h-4 w-px bg-[#8c6d58]/25" aria-hidden="true" />
      <label className="flex items-center gap-2 font-serif text-[10px] tracking-wider text-[#6b4f3f]">
        玻璃
        <input
          type="range"
          min={0.12}
          max={0.85}
          step={0.01}
          value={glassOpacity}
          onChange={(e) => setGlassOpacity(Number(e.target.value))}
          className="vibe-slider w-20"
          aria-label="阅读区玻璃透明度"
          title="调节羊皮纸玻璃透明度"
        />
      </label>
    </div>
  );

  const ui = (
    <section
      className="reading-space pointer-events-none fixed inset-0 z-[30] h-[100dvh] w-screen overflow-hidden"
      aria-label="沉浸式读书空间"
    >
      <div
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {READING_SCENES.map((item) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={item.background}
            alt=""
            className={`reading-scene-bg absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-[1200ms] ease-in-out ${
              scene === item.id ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        <div className="reading-space-veil absolute inset-0" />
      </div>

      <div
        className={`pointer-events-auto relative z-10 mx-auto flex h-full min-h-0 w-full flex-col ${
          isFull
            ? 'max-w-none px-3 pb-14 pt-20 sm:px-4 md:pt-24'
            : `px-4 pb-14 pt-20 md:pt-24 ${shellWidth}`
        }`}
      >
        {!isFull && (
          <header className="mb-2 shrink-0 text-center">
            <p className="font-display text-xl font-light tracking-[0.14em] text-[#5c4033] drop-shadow-[0_1px_8px_rgba(253,251,247,0.65)] md:text-2xl">
              Reading Space
            </p>
            <p className="mt-0.5 font-serif text-[10px] tracking-[0.28em] text-[#6b4f3f] drop-shadow-[0_1px_6px_rgba(253,251,247,0.55)]">
              沉浸书斋 · IMMERSIVE READING
            </p>
            {error && (
              <p className="mt-1 font-serif text-xs text-[#8b3a2a]">{error}</p>
            )}
            {booting && (
              <p className="mt-1 font-serif text-[11px] text-[#8c6d58]">
                正在恢复阅读记录…
              </p>
            )}
          </header>
        )}

        {(isFull && (error || booting)) && (
          <p className="mb-1 shrink-0 text-center font-serif text-xs text-[#8b3a2a]">
            {error || '正在恢复阅读记录…'}
          </p>
        )}

        <div
          className="reading-book-shell flex min-h-0 flex-1 flex-col overflow-hidden border border-[#8c6d58]/25 shadow-2xl backdrop-blur-md"
          style={{
            backgroundColor: `rgba(253, 251, 247, ${glassOpacity})`,
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3 md:p-3.5">
            <ReaderPane
              book={book}
              sessionId={sessionId}
              restoreMeta={restoreHint}
              sessions={sessions}
              onBookLoaded={(next, meta) => {
                setError('');
                setBook(next);
                setSessionId(meta.id);
                setRestoreHint(meta);
                refreshSessions();
              }}
              onSessionChange={(id, meta) => {
                setSessionId(id);
                setRestoreHint(meta);
                refreshSessions();
              }}
              onOpenSession={(id) => void openSession(id)}
              onRemoveSession={(id) => void deleteSession(id)}
              onError={setError}
            />
          </div>
        </div>
      </div>

      <div className="pointer-events-auto">
        <VibeController scene={scene} onSceneChange={setScene} />
      </div>
    </section>
  );

  if (!mounted) return null;

  return (
    <>
      {createPortal(ui, document.body)}
      {createPortal(sizeBar, document.body)}
    </>
  );
}
