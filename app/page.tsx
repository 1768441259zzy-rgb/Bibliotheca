import HandwrittenQuote from '@/components/HandwrittenQuote';
import InteractiveTitle from '@/components/InteractiveTitle';

export default function HomePage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-4xl flex-col items-center justify-center text-center -translate-y-8 md:-translate-y-10 lg:-translate-y-12">
      <InteractiveTitle
        text="Bibliotheca"
        variant="home"
        className="text-5xl md:text-6xl lg:text-[6.75rem]"
      />

      <p className="mt-8 text-sm tracking-[0.35em] text-ink-muted md:text-base">
        · EST. 2026 ·
      </p>

      <HandwrittenQuote />
    </section>
  );
}
