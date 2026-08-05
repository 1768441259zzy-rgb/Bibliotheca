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
      className="scroll-mt-24 rounded-sm border border-white/70 bg-white/55 p-4 shadow-card backdrop-blur-md sm:p-6 md:scroll-mt-28 md:p-10"
    >
      <header className="mb-5 flex items-start justify-between gap-3 border-b border-ink/10 pb-4 sm:mb-8 sm:gap-4 sm:pb-6">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-medium leading-snug text-ink sm:text-2xl md:text-3xl">
            {group.bookTitle}
          </h2>
          {group.author && (
            <p className="mt-1.5 text-xs tracking-widest text-ink-muted sm:mt-2 sm:text-sm">
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

      <div className="space-y-6 sm:space-y-8">
        {group.quotes.map((quote, index) => (
          <blockquote
            key={`${group.id}-${index}`}
            className="group/quote relative border-l-2 border-parchment-400/80 pl-3 sm:pl-6"
          >
            {(onEditQuote || onDeleteQuote) && (
              <div className="mb-2 flex justify-end gap-1.5 sm:absolute sm:right-0 sm:top-0 sm:z-10 sm:mb-0 sm:opacity-0 sm:transition-opacity sm:duration-300 sm:group-hover/quote:opacity-100">
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
            <p className="break-words whitespace-pre-line text-[15px] leading-[1.85] text-ink-light sm:text-base sm:leading-[1.9] md:pr-20 md:text-lg">
              {quote}
            </p>
          </blockquote>
        ))}
      </div>
    </article>
  );
}
