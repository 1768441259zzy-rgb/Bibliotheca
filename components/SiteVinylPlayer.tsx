'use client';

import { useEffect, useRef, useState } from 'react';

const MISTY_SRC = `/assets/sound/${encodeURIComponent(
  'Ella Fitzgerald,Erroll Garner,Johnny Burke - Misty.mp3'
)}`;

/** 全站共用一个 Audio，避免桌面/手机导航各挂一份导致“暂停了还在响” */
let sharedAudio: HTMLAudioElement | null = null;
let sharedUserPaused = false;
let sharedListeners = 0;

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    const audio = new Audio(MISTY_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.42;
    sharedAudio = audio;
  }
  return sharedAudio;
}

interface SiteVinylPlayerProps {
  /** 仅 Home 为 true：允许自动播放；离开 Home 会暂停且不自动播 */
  autoplayEnabled?: boolean;
}

export default function SiteVinylPlayer({
  autoplayEnabled = false,
}: SiteVinylPlayerProps) {
  const unlockNeededRef = useRef(false);
  const autoplayEnabledRef = useRef(autoplayEnabled);
  const removeUnlockRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  autoplayEnabledRef.current = autoplayEnabled;

  useEffect(() => {
    const audio = getSharedAudio();
    sharedListeners += 1;

    const onPlaying = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onReady = () => setReady(true);

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('canplay', onReady);
    if (audio.readyState >= 3) setReady(true);
    setPlaying(!audio.paused);

    return () => {
      removeUnlockRef.current?.();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('canplay', onReady);
      sharedListeners = Math.max(0, sharedListeners - 1);
      if (sharedListeners === 0) {
        audio.pause();
      }
    };
  }, []);

  useEffect(() => {
    const audio = getSharedAudio();

    const removeUnlock = () => {
      document.removeEventListener('pointerdown', onFirstGesture, true);
      document.removeEventListener('keydown', onFirstGesture, true);
      document.removeEventListener('touchstart', onFirstGesture, true);
      removeUnlockRef.current = null;
    };
    removeUnlockRef.current = removeUnlock;

    function onFirstGesture(e: Event) {
      if (!autoplayEnabledRef.current) {
        removeUnlock();
        return;
      }
      const target = e.target as Element | null;
      if (target?.closest?.('.site-vinyl')) return;
      if (sharedUserPaused || !unlockNeededRef.current) {
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

    if (!autoplayEnabled) {
      unlockNeededRef.current = false;
      removeUnlock();
      audio.pause();
      return () => removeUnlock();
    }

    if (sharedUserPaused) {
      return () => removeUnlock();
    }

    let cancelled = false;
    const tryAutoplay = async () => {
      if (cancelled || sharedUserPaused || !autoplayEnabledRef.current) return;
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
    };
  }, [autoplayEnabled]);

  async function toggle() {
    const audio = getSharedAudio();
    try {
      if (audio.paused) {
        sharedUserPaused = false;
        unlockNeededRef.current = false;
        removeUnlockRef.current?.();
        await audio.play();
      } else {
        sharedUserPaused = true;
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
