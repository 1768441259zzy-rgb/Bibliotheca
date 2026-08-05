'use client';

import { useEffect, useRef, useState } from 'react';
import InteractiveTitle from '@/components/InteractiveTitle';

export interface PublicNote {
  id: string;
  name: string;
  content: string;
  stamp: string;
  createdAt: string;
}

interface GuestNoteWallProps {
  refreshKey?: number;
  newest?: PublicNote | null;
}

function formatFlyleafDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function NoteCard({
  note,
  index,
  onDelete,
  deleting,
}: {
  note: PublicNote;
  index: number;
  onDelete: (id: string) => void;
  deleting?: boolean;
}) {
  const tilt = index % 2 === 0 ? -9 : 11;

  return (
    <article className="guest-note group/note relative w-[17.5rem] shrink-0 border border-[#8c6d58]/22 bg-[#fdfbf7]/88 px-5 pb-14 pt-4 shadow-[0_4px_18px_rgba(61,47,42,0.06)] backdrop-blur-sm sm:w-[19rem]">
      <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[#8c6d58]/15" />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(note.id);
        }}
        disabled={deleting}
        title="删除这条留言"
        aria-label="删除这条留言"
        className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-sm text-[#8c6d58]/25 opacity-0 transition-all duration-300 hover:bg-[#8c6d58]/8 hover:text-[#8b3a2a]/70 group-hover/note:opacity-100 disabled:opacity-40"
      >
        <span className="text-[11px] leading-none" aria-hidden="true">
          ✖
        </span>
      </button>

      <p className="pr-6 font-display text-sm tracking-wide text-[#6b4f3f]">
        {note.name}
      </p>
      <p className="mt-2.5 line-clamp-4 whitespace-pre-wrap text-sm leading-[1.85] text-ink-light">
        {note.content}
      </p>

      <div className="absolute bottom-3 right-3.5 flex flex-col items-center gap-1">
        <div
          className="guest-note-seal flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-[#8b3a2a]/70 bg-[radial-gradient(circle_at_35%_30%,#f3e2d4,#e0b9a0_52%,#c4896e)] text-[#8b3a2a] shadow-[0_0_0_3px_rgba(139,58,42,0.08),inset_0_1px_0_rgba(255,255,255,0.28)]"
          style={{ transform: `rotate(${tilt}deg)` }}
          aria-hidden="true"
        >
          <span className="absolute inset-[3px] rounded-full border border-[#8b3a2a]/35" />
          <span className="relative text-[15px] leading-none">{note.stamp}</span>
        </div>
        <time
          dateTime={note.createdAt}
          className="font-display text-[9px] tracking-[0.16em] text-ink-muted"
          style={{ transform: `rotate(${tilt * 0.35}deg)` }}
        >
          {formatFlyleafDate(note.createdAt)}
        </time>
      </div>
    </article>
  );
}

export default function GuestNoteWall({
  refreshKey = 0,
  newest = null,
}: GuestNoteWallProps) {
  const [notes, setNotes] = useState<PublicNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const readyRef = useRef(false);
  const rafRef = useRef(0);
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/messages');
        const data = (await res.json()) as {
          messages?: PublicNote[];
        };
        if (!cancelled && res.ok && Array.isArray(data.messages)) {
          setNotes(data.messages);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!newest) return;
    setNotes((prev) => {
      if (prev.some((n) => n.id === newest.id)) return prev;
      return [newest, ...prev];
    });
  }, [newest]);

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);

    const previous = notes;
    setNotes((prev) => prev.filter((n) => n.id !== id));

    try {
      const res = await fetch(`/api/messages?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setNotes(previous);
        console.error(data.error || '删除失败');
      }
    } catch {
      setNotes(previous);
      console.error('删除留言失败');
    } finally {
      setDeletingId(null);
    }
  }

  // 单向循环：先从中间出现，向右滚出，再从左侧进入
  useEffect(() => {
    if (notes.length === 0) return;

    const SPEED = 0.78; // px / 16ms，略加快
    let last = performance.now();
    readyRef.current = false;

    const placeAtCenter = () => {
      const viewport = viewportRef.current;
      const track = trackRef.current;
      if (!viewport || !track) return false;
      // 起始：整组居中出现在视口中间
      xRef.current = (viewport.clientWidth - track.scrollWidth) / 2;
      track.style.transform = `translate3d(${xRef.current}px, 0, 0)`;
      readyRef.current = true;
      return true;
    };

    const placeAtLeft = () => {
      const track = trackRef.current;
      if (!track) return;
      xRef.current = -track.scrollWidth;
      track.style.transform = `translate3d(${xRef.current}px, 0, 0)`;
    };

    const boot = requestAnimationFrame(() => {
      placeAtCenter();
    });

    const step = (now: number) => {
      const viewport = viewportRef.current;
      const track = trackRef.current;
      if (!viewport || !track) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      if (!readyRef.current) {
        placeAtCenter();
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const dt = Math.min(32, now - last);
      last = now;

      xRef.current += SPEED * (dt / 16);
      // 整组完全离开右边缘后，从左侧再滚入
      if (xRef.current >= viewport.clientWidth) {
        placeAtLeft();
      } else {
        track.style.transform = `translate3d(${xRef.current}px, 0, 0)`;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    const onResize = () => {
      readyRef.current = false;
      placeAtCenter();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(boot);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [notes]);

  return (
    <section className="mt-16 w-full border-t border-ink/10 pt-12">
      <header className="mb-8 text-center">
        <InteractiveTitle
          text="Guest Notes"
          as="h2"
          variant="section"
          className="text-2xl md:text-3xl"
        />
        <p className="mt-3 text-[10px] tracking-[0.22em] text-ink-muted">
          扉页落款 · FLYLEAF MESSAGES
        </p>
      </header>

      {loading && notes.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-muted">正在翻开扉页…</p>
      )}

      {!loading && notes.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-muted">
          尚无落款。愿你成为第一枚印章。
        </p>
      )}

      {notes.length > 0 && (
        <div
          ref={viewportRef}
          className="guest-note-marquee relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden py-4"
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#f6f0e6] via-[#f6f0e6]/85 to-transparent sm:w-24" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#f6f0e6] via-[#f6f0e6]/85 to-transparent sm:w-24" />

          <div
            ref={trackRef}
            className="guest-note-track flex w-max gap-5 px-6 will-change-transform"
          >
            {notes.map((note, index) => (
              <NoteCard
                key={note.id}
                note={note}
                index={index}
                onDelete={handleDelete}
                deleting={deletingId === note.id}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
