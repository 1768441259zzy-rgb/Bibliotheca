'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import SiteVinylPlayer from '@/components/SiteVinylPlayer';
import TransitionLink from '@/components/TransitionLink';

const navItems = [
  { href: '/', label: 'HOME' },
  { href: '/cover-art', label: 'COVER ART' },
  { href: '/highlights', label: 'HIGHLIGHTS' },
  { href: '/vocabulary', label: 'VOCABULARY' },
  { href: '/reading-space', label: 'READING' },
  { href: '/about', label: 'ABOUT' },
];

export default function Navbar() {
  const pathname = usePathname();
  const onReading = pathname.startsWith('/reading-space');
  const onHome = pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-[70] ${
        onReading
          ? 'pointer-events-none'
          : 'bg-gradient-to-b from-[#e6c8ba]/90 via-[#f0d8cc]/75 to-transparent backdrop-blur-[2px]'
      }`}
    >
      {/* 全站只挂一个唱片，避免桌面/手机各一份导致暂停失效 */}
      <div className="pointer-events-auto absolute right-4 top-3.5 z-[71] md:right-8 md:top-8">
        <SiteVinylPlayer autoplayEnabled={onHome} />
      </div>

      {/* —— 桌面：整组导航靠右；唱片留在右上角 —— */}
      <div className="hidden items-center justify-end px-10 py-8 pr-[4.25rem] md:flex">
        <ul
          className={`flex flex-wrap items-center justify-end gap-x-5 text-sm tracking-[0.25em] text-ink-light ${
            onReading
              ? 'pointer-events-auto rounded-sm border border-[#8c6d58]/15 bg-[#fdfbf7]/30 px-4 py-2 shadow-sm backdrop-blur-lg'
              : ''
          }`}
        >
          {navItems.map((item, index) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <li key={item.href} className="flex items-center">
                {index > 0 && (
                  <span className="mr-5 text-ink-muted/60" aria-hidden="true">
                    |
                  </span>
                )}
                <TransitionLink
                  href={item.href}
                  className={`nav-link relative pb-1 transition-colors duration-700 ease-out hover:text-ink ${
                    isActive ? 'nav-link-active text-ink' : ''
                  }`}
                >
                  {item.label}
                </TransitionLink>
              </li>
            );
          })}
        </ul>
      </div>

      {/* —— 手机：汉堡靠左；唱片右上角 —— */}
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3.5 pr-14 md:hidden ${
          onReading ? 'pointer-events-auto' : ''
        }`}
      >
        <button
          type="button"
          aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-[#8c6d58]/25 bg-[#fdfbf7]/55 text-ink backdrop-blur-sm"
        >
          <span className="sr-only">Menu</span>
          <span className="flex w-4 flex-col gap-[5px]" aria-hidden="true">
            <span
              className={`h-px w-full bg-current transition-transform duration-300 ${
                menuOpen ? 'translate-y-[6px] rotate-45' : ''
              }`}
            />
            <span
              className={`h-px w-full bg-current transition-opacity duration-300 ${
                menuOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`h-px w-full bg-current transition-transform duration-300 ${
                menuOpen ? '-translate-y-[6px] -rotate-45' : ''
              }`}
            />
          </span>
        </button>
      </div>

      {menuOpen && (
        <div className="pointer-events-auto border-t border-[#8c6d58]/15 bg-[#fdfbf7]/95 px-4 py-3 shadow-card backdrop-blur-md md:hidden">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <TransitionLink
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`block px-2 py-2.5 text-xs tracking-[0.22em] transition-colors ${
                      isActive
                        ? 'text-ink'
                        : 'text-ink-light hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </TransitionLink>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}
