import type { HighlightGroup } from '@/data/content';

interface HighlightCardProps {
  group: HighlightGroup;
  onEditGroup?: (group: HighlightGroup) => void;
  onDeleteGroup?: (group: HighlightGroup) => void;
  onEditQuote?: (group: HighlightGroup, quoteIndex: number) => void;
  onDeleteQuote?: (group: HighlightGroup, quoteIndex: number) => void;
}

export default function HighlightCard({
  group,
  onEditGroup,
  onDeleteGroup,
  onEditQuote,
  onDeleteQuote,
}: HighlightCardProps) {
  return (
    <article
      id={`highlight-${group.id}`}
      className="scroll-mt-28 rounded-sm border border-white/70 bg-white/55 p-8 shadow-card backdrop-blur-md md:p-10"
    >
      <header className="mb-8 flex items-start justify-between gap-4 border-b border-ink/10 pb-6">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-medium leading-snug text-ink md:text-3xl">
            {group.bookTitle}
          </h2>
          {group.author && (
            <p className="mt-2 text-sm tracking-widest text-ink-muted">
              — {group.author}
            </p>
          )}
        </div>

        {(onEditGroup || onDeleteGroup) && (
          <div className="flex shrink-0 gap-1.5">
            {onEditGroup && (
              <button
                type="button"
                onClick={() => onEditGroup(group)}
                className="border border-ink/15 bg-white/40 px-2 py-1 text-[10px] tracking-wider text-ink-muted transition hover:border-[#c9a84c]/50 hover:text-ink"
              >
                编辑
              </button>
            )}
            {onDeleteGroup && (
              <button
                type="button"
                onClick={() => onDeleteGroup(group)}
                className="border border-ink/15 bg-white/40 px-2 py-1 text-[10px] tracking-wider text-ink-muted transition hover:border-red-800/30 hover:text-red-900/80"
              >
                删除
              </button>
            )}
          </div>
        )}
      </header>

      <div className="space-y-8">
        {group.quotes.map((quote, index) => (
          <blockquote
            key={`${group.id}-${index}`}
            className="group/quote relative pl-6 before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-parchment-400/80"
          >
            {(onEditQuote || onDeleteQuote) && (
              <div className="absolute right-0 top-0 z-10 flex gap-1.5 opacity-0 transition-opacity duration-300 group-hover/quote:opacity-100">
                {onEditQuote && (
                  <button
                    type="button"
                    onClick={() => onEditQuote(group, index)}
                    className="border border-ink/15 bg-[#fcf7f4]/90 px-2 py-1 text-[10px] tracking-wider text-ink-muted transition hover:border-[#c9a84c]/50 hover:text-ink"
                  >
                    编辑
                  </button>
                )}
                {onDeleteQuote && (
                  <button
                    type="button"
                    onClick={() => onDeleteQuote(group, index)}
                    className="border border-ink/15 bg-[#fcf7f4]/90 px-2 py-1 text-[10px] tracking-wider text-ink-muted transition hover:border-red-800/30 hover:text-red-900/80"
                  >
                    删除
                  </button>
                )}
              </div>
            )}
            <p className="whitespace-pre-line pr-20 text-base leading-[1.9] text-ink-light md:text-lg">
              {quote}
            </p>
          </blockquote>
        ))}
      </div>
    </article>
  );
}
