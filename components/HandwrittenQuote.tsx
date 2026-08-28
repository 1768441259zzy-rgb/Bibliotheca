'use client';

const QUOTE = 'Where aesthetics meet the echo of words.';

export default function HandwrittenQuote() {
  const parts = QUOTE.split(/(\s+)/);

  return (
    <p
      className="font-quote relative z-20 mt-5 max-w-[16rem] text-base leading-relaxed text-ink-light sm:mt-6 sm:max-w-lg sm:text-lg md:text-xl"
      aria-label={`"${QUOTE}"`}
    >
      <span className="handwrite-char handwrite-mark" style={{ animationDelay: '1.45s' }}>
        &ldquo;
      </span>
      {parts.map((part, partIndex) => {
        let charOffset = parts.slice(0, partIndex).join('').length;
        if (/^\s+$/.test(part)) {
          return (
            <span key={`sp-${partIndex}`} className="handwrite-char" style={{ animationDelay: `${1.55 + charOffset * 0.055}s` }}>
              {'\u00A0'}
            </span>
          );
        }
        return (
          <span key={`w-${partIndex}`} className="inline-block whitespace-nowrap">
            {part.split('').map((char) => {
              const delay = 1.55 + charOffset * 0.055;
              charOffset += 1;
              return (
                <span key={`${char}-${charOffset}`} className="handwrite-char" style={{ animationDelay: `${delay}s` }}>
                  {char}
                </span>
              );
            })}
          </span>
        );
      })}
      <span
        className="handwrite-char handwrite-mark"
        style={{ animationDelay: `${1.55 + QUOTE.length * 0.055 + 0.08}s` }}
      >
        &rdquo;
      </span>
    </p>
  );
}
