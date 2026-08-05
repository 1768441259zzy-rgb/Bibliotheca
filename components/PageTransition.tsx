'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** 统一慢进场；离场由 navigateSoft + .page-leaving 负责 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const isReading = pathname.startsWith('/reading-space');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.classList.remove('page-leaving');

    const clear = () => {
      el.style.transform = 'none';
      el.style.filter = 'none';
    };

    const onEnd = (e: AnimationEvent) => {
      if (e.target !== el) return;
      clear();
    };

    el.addEventListener('animationend', onEnd);
    return () => el.removeEventListener('animationend', onEnd);
  }, [pathname]);

  return (
    <div
      key={pathname}
      ref={ref}
      className={`page-transition ${
        isReading ? 'page-anim-reading' : 'page-anim-enter'
      }`}
    >
      {children}
    </div>
  );
}
