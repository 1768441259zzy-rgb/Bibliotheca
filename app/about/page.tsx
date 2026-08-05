'use client';

import { useEffect, useState } from 'react';
import KeepInTouch from '@/components/KeepInTouch';
import InteractiveTitle from '@/components/InteractiveTitle';

export default function AboutPage() {
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const fadeDistance = 320;
      setReveal(Math.min(1, window.scrollY / fadeDistance));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-2xl flex-col items-center pb-48 pt-10 text-center md:pb-56 md:pt-14">
      <InteractiveTitle
        text="About"
        variant="page"
        className="text-4xl md:text-5xl"
      />

      <p className="mt-4 text-sm tracking-[0.2em] text-ink-muted">
        · BIBLIOTHECA ·
      </p>

      <div className="mt-10 space-y-6 text-left text-base leading-[1.9] text-ink-light md:text-lg">
        <p>你好芽，这里是 Seed。</p>
        <p>
          Bibliotheca 是一座私人的数字藏书阁，收藏 vintage 书皮的视觉之美，
          以及阅读时在页边留下的金句与回响。
        </p>
        <p>
          这里不追求完整的目录，只保留那些值得被再次看见、再次诵读的片段——
          装帧的纹理，与文字的温度。
        </p>
      </div>

      <div
        className="w-full transition-opacity duration-200"
        style={{ opacity: 0.2 + reveal * 0.8 }}
      >
        <KeepInTouch />
      </div>
    </section>
  );
}
