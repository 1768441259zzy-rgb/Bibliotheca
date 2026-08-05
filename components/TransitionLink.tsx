'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps, MouseEvent } from 'react';
import { navigateSoft } from '@/lib/navTransition';

type TransitionLinkProps = ComponentProps<typeof Link>;

export default function TransitionLink({
  href,
  onClick,
  replace,
  ...rest
}: TransitionLinkProps) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const url =
      typeof href === 'string'
        ? href
        : href.pathname
          ? `${href.pathname}${href.search ?? ''}${href.hash ?? ''}`
          : '';
    if (!url || url.startsWith('http') || url.startsWith('mailto:')) return;

    e.preventDefault();
    navigateSoft(url, (to) => {
      if (replace) router.replace(to);
      else router.push(to);
    });
  }

  return <Link href={href} onClick={handleClick} replace={replace} {...rest} />;
}
