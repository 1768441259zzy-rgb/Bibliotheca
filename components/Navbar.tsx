'use client';

import { usePathname } from 'next/navigation';
import SiteVinylPlayer from '@/components/SiteVinylPlayer';
import TransitionLink from '@/components/TransitionLink';

const navItems = [
  { href: '/', label: 'HOME' },
  { href: '/cover-art', label: 'COVER ART' },
  { href: '/highlights', label: 'HIGHLIGHTS' },
  { href: '/reading-space', label: 'READING' },
  { href: '/about', label: 'ABOUT' },
];

export default function Navbar() {
  const pathname = usePathname();
  const onReading = pathname.startsWith('/reading-space');

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-[70] flex items-center justify-end px-6 py-6 pr-5 md:px-10 md:py-8 md:pr-8 ${
        onReading
          ? 'pointer-events-none'
          : 'bg-gradient-to-b from-[#e6c8ba]/90 via-[#f0d8cc]/75 to-transparent backdrop-blur-[2px]'
      }`}
    >
      <ul
        className={`flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-xs tracking-[0.25em] text-ink-light md:gap-x-5 md:text-sm ${
          onReading
            ? 'pointer-events-auto rounded-sm border border-[#8c6d58]/15 bg-[#fdfbf7]/30 px-3 py-2 shadow-sm backdrop-blur-lg md:px-4'
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
                <span
                  className="mr-3 text-ink-muted/60 md:mr-5"
                  aria-hidden="true"
                >
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
        <li className="flex items-center pl-2.5 md:pl-3.5">
          <SiteVinylPlayer />
        </li>
      </ul>
    </nav>
  );
}
