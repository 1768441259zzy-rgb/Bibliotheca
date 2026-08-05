type NavigateFn = (href: string) => void;

let navigating = false;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** 慢离场 → 跳转 → 由 PageTransition 做慢进场（全程可控，比 View Transition 更丝滑） */
export function navigateSoft(href: string, push: NavigateFn) {
  if (typeof window === 'undefined') {
    push(href);
    return;
  }

  const current = window.location.pathname;
  if (current === href || navigating) return;

  if (prefersReducedMotion()) {
    push(href);
    return;
  }

  const el = document.querySelector('.page-transition');
  if (!el) {
    push(href);
    return;
  }

  navigating = true;
  el.classList.add('page-leaving');

  window.setTimeout(() => {
    push(href);
    // 进场开始后再解锁，避免连点打断
    window.setTimeout(() => {
      navigating = false;
    }, 200);
  }, 900);
}
