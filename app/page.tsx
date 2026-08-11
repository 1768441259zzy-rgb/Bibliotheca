import HandwrittenQuote from '@/components/HandwrittenQuote';
import InteractiveTitle from '@/components/InteractiveTitle';

export default function HomePage() {
  return (
    <section className="relative z-20 mx-auto flex min-h-[calc(100vh-12rem)] max-w-4xl flex-col items-center justify-center text-center -translate-y-6 px-2 sm:-translate-y-8 md:-translate-y-10 lg:-translate-y-12">
      <InteractiveTitle
        text="Bibliotheca"
        variant="home"
        className="text-4xl sm:text-5xl md:text-6xl lg:text-[6.75rem]"
      />

      <p className="mt-6 text-xs tracking-[0.28em] text-ink-muted sm:mt-8 sm:text-sm sm:tracking-[0.35em] md:text-base">
        · EST. 2026 ·
      </p>

      <HandwrittenQuote />
    </section>
  );
}
