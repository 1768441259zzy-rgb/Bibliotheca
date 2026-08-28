'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { siteDecorations } from '@/data/content';

export default function Decorations() {
  const pathname = usePathname();
  const hideEnvelope =
    pathname.startsWith('/cover-art') ||
    pathname.startsWith('/highlights') ||
    pathname.startsWith('/reading-space');
  const lilyBehindContent = pathname.startsWith('/highlights');
  const showBooks = pathname === '/';
  const homeLilyLeft = pathname === '/';
  const hideTopLily = pathname === '/' || pathname.startsWith('/reading-space');
  const showRightLily =
    pathname.startsWith('/cover-art') ||
    pathname.startsWith('/highlights') ||
    pathname === '/about';
  const isAbout = pathname === '/about';
  const showBabysBreath = isAbout;
  const [envelopeOpacity, setEnvelopeOpacity] = useState(1);

  useEffect(() => {
    if (!isAbout) {
      setEnvelopeOpacity(1);
      return;
    }

    const onScroll = () => {
      const fadeDistance = 320;
      const next = Math.max(0, 1 - window.scrollY / fadeDistance);
      setEnvelopeOpacity(next);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isAbout]);

  useEffect(() => {
    let frame = 0;
    const nearState = new WeakMap<HTMLElement, boolean>();

    const getHitBox = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const hit = el.dataset.hit ?? 'full';

      if (hit === 'left') {
        return {
          left: rect.left,
          right: rect.left + rect.width * 0.38,
          top: rect.bottom - rect.height * 0.62,
          bottom: rect.bottom,
        };
      }
      if (hit === 'right') {
        return {
          left: rect.right - rect.width * 0.45,
          right: rect.right,
          top: rect.bottom - rect.height * 0.75,
          bottom: rect.bottom,
        };
      }
      if (hit === 'top') {
        return {
          left: rect.left,
          right: rect.left + rect.width * 0.5,
          top: rect.top,
          bottom: rect.top + rect.height * 0.65,
        };
      }
      if (hit === 'books-left') {
        return {
          left: rect.left,
          right: rect.left + rect.width * 0.48,
          top: rect.top + rect.height * 0.12,
          bottom: rect.bottom,
        };
      }
      if (hit === 'books-right') {
        return {
          left: rect.left + rect.width * 0.52,
          right: rect.right,
          top: rect.top + rect.height * 0.12,
          bottom: rect.bottom,
        };
      }
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    };

    const getRestTransform = (el: HTMLElement) => {
      if (el.classList.contains('lily-sway-right-wrap')) return 'rotate(24deg)';
      if (el.classList.contains('lily-sway-right')) return 'scaleX(-1)';
      if (el.classList.contains('books-float-right')) return 'translateX(12px)';
      if (el.classList.contains('books-float-left')) return 'translateY(0)';
      return 'none';
    };

    const keepInlineRest = (el: HTMLElement) =>
      el.classList.contains('lily-sway-right-wrap') ||
      el.classList.contains('lily-sway-right') ||
      el.classList.contains('books-float-right');

    const settleMotion = (el: HTMLElement, activeClass: string) => {
      const computed = getComputedStyle(el).transform;
      const rest = getRestTransform(el);

      el.classList.remove(activeClass);
      el.style.animation = 'none';
      el.style.transition = 'none';
      el.style.transform = computed === 'none' ? rest : computed;

      void el.offsetWidth;
      el.style.transition = 'transform 1.5s cubic-bezier(0.33, 1, 0.32, 1)';
      el.style.transform = rest;

      const onEnd = (event: TransitionEvent) => {
        if (event.propertyName !== 'transform') return;
        el.style.transition = '';
        el.style.animation = '';
        if (!keepInlineRest(el)) {
          el.style.transform = '';
        }
        el.removeEventListener('transitionend', onEnd);
      };
      el.addEventListener('transitionend', onEnd);
    };

    const startSway = (el: HTMLElement) => {
      el.style.transition = '';
      el.style.animation = '';
      if (!el.classList.contains('lily-sway-right')) {
        el.style.transform = '';
      } else {
        el.style.transform = 'scaleX(-1)';
      }
      el.classList.add('is-swaying');
    };

    const startFloat = (el: HTMLElement) => {
      el.style.transition = '';
      el.style.animation = '';
      el.style.transform = '';
      el.classList.add('is-floating');
    };

    const onMove = (e: MouseEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;

        document.querySelectorAll<HTMLElement>('.lily-sway').forEach((lily) => {
          const box = getHitBox(lily);
          const near =
            e.clientX >= box.left &&
            e.clientX <= box.right &&
            e.clientY >= box.top &&
            e.clientY <= box.bottom;
          const wasNear = nearState.get(lily) ?? false;
          const wrap = lily.closest(
            '.lily-sway-right-wrap'
          ) as HTMLElement | null;

          if (near && !wasNear) {
            startSway(lily);
            if (wrap) startSway(wrap);
          } else if (!near && wasNear) {
            settleMotion(lily, 'is-swaying');
            if (wrap) settleMotion(wrap, 'is-swaying');
          }

          nearState.set(lily, near);
        });

        document
          .querySelectorAll<HTMLElement>('.books-float')
          .forEach((books) => {
            const box = getHitBox(books);
            const near =
              e.clientX >= box.left &&
              e.clientX <= box.right &&
              e.clientY >= box.top &&
              e.clientY <= box.bottom;
            const wasNear = nearState.get(books) ?? false;

            if (near && !wasNear) {
              startFloat(books);
            } else if (!near && wasNear) {
              settleMotion(books, 'is-floating');
            }

            nearState.set(books, near);
          });
      });
    };

    const clearMotion = () => {
      document.querySelectorAll<HTMLElement>('.lily-sway').forEach((lily) => {
        if (nearState.get(lily)) {
          settleMotion(lily, 'is-swaying');
          const wrap = lily.closest(
            '.lily-sway-right-wrap'
          ) as HTMLElement | null;
          if (wrap) settleMotion(wrap, 'is-swaying');
        }
        nearState.set(lily, false);
      });

      document.querySelectorAll<HTMLElement>('.books-float').forEach((books) => {
        if (nearState.get(books)) {
          settleMotion(books, 'is-floating');
        }
        nearState.set(books, false);
      });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', clearMotion);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', clearMotion);
      if (frame) window.cancelAnimationFrame(frame);
      clearMotion();
    };
  }, [pathname]);

  return (
    <>
      {/* About 左上满天星：略偏左下，枝干与百合茎部汇合 */}
      {showBabysBreath && (
        <div
          className="pointer-events-none fixed z-[18] w-48 origin-bottom-left sm:w-56 md:w-72 lg:w-80"
          style={{
            left: '-12%',
            top: '2%',
            transform: 'translateY(18%)',
          }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteDecorations.babysBreath}
            alt=""
            width={1200}
            height={1200}
            className="h-auto w-full object-contain object-left-bottom opacity-90"
          />
        </div>
      )}

      {/* 左上角百合 —— 首页不显示 */}
      {!hideTopLily && (
        <div
          className={`pointer-events-none fixed left-0 top-0 w-48 sm:w-56 md:w-72 lg:w-80 ${
            lilyBehindContent ? 'z-[1]' : 'z-20'
          }`}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteDecorations.lilyFlower}
            alt=""
            width={1536}
            height={1024}
            data-hit="top"
            className="lily-sway lily-sway-top h-auto w-full object-contain object-left-top mix-blend-screen"
          />
        </div>
      )}

      {/* 首页左侧百合：手机明显缩小，并压到正文下方，避免挡住引言 */}
      {homeLilyLeft && (
        <div
          className="pointer-events-none fixed bottom-[-4%] left-[-18%] z-[15] h-[34vh] w-[46vw] origin-bottom-left -rotate-[14deg] sm:bottom-0 sm:left-[-8%] sm:h-[48vh] sm:w-[38vw] sm:-rotate-[18deg] md:left-0 md:h-[calc(100vh-5.5rem)] md:w-auto md:max-w-[55vw] md:-rotate-[20deg]"
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteDecorations.lilyFlower}
            alt=""
            width={1536}
            height={1024}
            data-hit="left"
            className="lily-sway lily-sway-left h-full w-full object-contain object-left-bottom mix-blend-screen md:w-auto md:max-w-none"
          />
        </div>
      )}

      {/*
        右下角百合：水平翻转后贴右墙往里生长
        外层负责贴墙旋转，内层负责水平翻转（原点分开，避免翻出屏幕）
      */}
      {showRightLily && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[35]"
          style={{
            right: '1%',
            bottom: '-10%',
            width: 'min(66vw, 700px)',
            zIndex: 35,
          }}
        >
          <div
            className="lily-sway-right-wrap"
            style={{
              transform: 'rotate(24deg)',
              transformOrigin: '100% 95%',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteDecorations.lilyFlowerTransparent}
              alt=""
              width={1536}
              height={1024}
              data-hit="right"
              className="lily-sway lily-sway-right"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                transform: 'scaleX(-1)',
                transformOrigin: 'center center',
              }}
            />
          </div>
        </div>
      )}

      {/* 首页 books：手机略收，并压到正文下方 */}
      {showBooks && (
        <div
          className="pointer-events-none fixed bottom-[calc(7%-2mm)] left-0 right-0 z-[8] w-screen origin-bottom scale-[0.92] sm:bottom-[calc(8%-2mm)] sm:scale-[1.02] md:bottom-[calc(9%-2mm)] md:scale-[1.08]"
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteDecorations.books}
            alt=""
            width={1672}
            height={941}
            className="invisible h-auto w-full"
          />
          <div
            data-hit="books-left"
            className="books-float books-float-left absolute inset-0"
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, #000 0%, #000 50%, transparent 50%)',
              maskImage:
                'linear-gradient(to right, #000 0%, #000 50%, transparent 50%)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteDecorations.books}
              alt=""
              width={1672}
              height={941}
              className="h-auto w-full object-contain object-bottom mix-blend-screen"
            />
          </div>
          <div
            data-hit="books-right"
            className="books-float books-float-right absolute inset-0"
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, transparent 50%, #000 50%)',
              maskImage:
                'linear-gradient(to right, transparent 50%, #000 50%)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteDecorations.books}
              alt=""
              width={1672}
              height={941}
              className="h-auto w-full object-contain object-bottom mix-blend-screen"
            />
          </div>
        </div>
      )}

      {/* 底部信封：手机裁切放大粉色区域，约占屏高 1/4 */}
      {!hideEnvelope && (
        <div
          className={`pointer-events-none fixed bottom-0 left-0 w-full origin-bottom transition-opacity duration-150 ${
            isAbout ? 'z-40' : 'z-[4]'
          } ${
            pathname === '/'
              ? 'h-[30vh] overflow-hidden sm:h-[26vh] md:h-auto md:overflow-visible'
              : ''
          }`}
          style={{ opacity: isAbout ? envelopeOpacity : 1 }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteDecorations.envelopeBottom}
            alt=""
            width={1672}
            height={941}
            className={`w-full mix-blend-screen ${
              pathname === '/'
                ? 'absolute bottom-0 left-1/2 h-[240%] max-w-none -translate-x-1/2 object-cover object-bottom sm:h-[200%] md:relative md:left-0 md:h-auto md:w-full md:translate-x-0 md:object-cover'
                : 'h-auto object-cover object-bottom'
            }`}
          />
        </div>
      )}
    </>
  );
}
