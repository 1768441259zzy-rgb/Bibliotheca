'use client';

import { useEffect, useRef, useState } from 'react';

const MISTY_SRC = `/assets/sound/${encodeURIComponent(
  'Ella Fitzgerald,Erroll Garner,Johnny Burke - Misty.flac'
)}`;

export default function SiteVinylPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userPausedRef = useRef(false);
  const unlockNeededRef = useRef(false);
  const removeUnlockRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem('bibliotheca-site-vinyl');
    } catch {
      // ignore
    }

    const audio = new Audio(MISTY_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.42;
    audioRef.current = audio;

    const onPlaying = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onReady = () => setReady(true);

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('canplay', onReady);

    let cancelled = false;

    const removeUnlock = () => {
      document.removeEventListener('pointerdown', onFirstGesture, true);
      document.removeEventListener('keydown', onFirstGesture, true);
      document.removeEventListener('touchstart', onFirstGesture, true);
      removeUnlockRef.current = null;
    };
    removeUnlockRef.current = removeUnlock;

    function onFirstGesture(e: Event) {
      if (cancelled) {
        removeUnlock();
        return;
      }
      const target = e.target as Element | null;
      // 点唱片本身交给 toggle，避免 play 后又被 pause
      if (target?.closest?.('.site-vinyl')) return;
      if (userPausedRef.current || !unlockNeededRef.current) {
        removeUnlock();
        return;
      }
      unlockNeededRef.current = false;
      removeUnlock();
      void audio.play().catch(() => setPlaying(false));
    }

    const armUnlock = () => {
      unlockNeededRef.current = true;
      document.addEventListener('pointerdown', onFirstGesture, true);
      document.addEventListener('keydown', onFirstGesture, true);
      document.addEventListener('touchstart', onFirstGesture, true);
    };

    const tryAutoplay = async () => {
      if (cancelled || userPausedRef.current) return;
      try {
        await audio.play();
        unlockNeededRef.current = false;
        removeUnlock();
      } catch {
        setPlaying(false);
        armUnlock();
      }
    };

    if (audio.readyState >= 3) {
      void tryAutoplay();
    } else {
      audio.addEventListener('canplay', () => void tryAutoplay(), { once: true });
    }

    return () => {
      cancelled = true;
      removeUnlock();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('canplay', onReady);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    };
  }, []);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        userPausedRef.current = false;
        unlockNeededRef.current = false;
        removeUnlockRef.current?.();
        await audio.play();
      } else {
        userPausedRef.current = true;
        unlockNeededRef.current = false;
        removeUnlockRef.current?.();
        audio.pause();
      }
    } catch {
      setPlaying(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-label={playing ? '暂停 Misty' : '播放 Misty'}
      title={playing ? '暂停 · Misty' : ready ? '播放 · Misty' : '加载中 · Misty'}
      className="site-vinyl group relative h-8 w-8 shrink-0 rounded-full outline-none transition-transform duration-500 hover:scale-105 focus-visible:ring-1 focus-visible:ring-[#8c6d58]/35 md:h-9 md:w-9"
    >
      <span
        className={`site-vinyl-disc absolute inset-0 rounded-full ${
          playing ? 'is-spinning' : ''
        }`}
        aria-hidden="true"
      >
        <span className="site-vinyl-grooves absolute inset-[11%] rounded-full" />
        <span className="site-vinyl-label absolute inset-[32%] rounded-full" />
        <span className="site-vinyl-hole absolute inset-[46%] rounded-full" />
      </span>
      <span className="sr-only">
        {playing ? 'Pause Misty' : 'Play Misty'}
      </span>
    </button>
  );
}
