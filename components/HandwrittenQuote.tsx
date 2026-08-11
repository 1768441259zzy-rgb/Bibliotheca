'use client';

const QUOTE = 'Where aesthetics meet the echo of words.';

export default function HandwrittenQuote() {
  return (
    <p
      className="font-quote relative z-20 mt-5 max-w-[16rem] text-base leading-relaxed text-ink-light sm:mt-6 sm:max-w-lg sm:text-lg md:text-xl"
      aria-label={`"${QUOTE}"`}
    >
      <span className="handwrite-char handwrite-mark" style={{ animationDelay: '1.45s' }}>
        &ldquo;
      </span>
      {QUOTE.split('').map((char, index) => (
        <span
          key={`${char}-${index}`}
          className="handwrite-char"
          style={{ animationDelay: `${1.55 + index * 0.055}s` }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
      <span
        className="handwrite-char handwrite-mark"
        style={{ animationDelay: `${1.55 + QUOTE.length * 0.055 + 0.08}s` }}
      >
        &rdquo;
      </span>
    </p>
  );
}
