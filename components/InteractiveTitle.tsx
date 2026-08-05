'use client';

interface InteractiveTitleProps {
  text: string;
  as?: 'h1' | 'h2';
  className?: string;
  /** home | page | section —— 略有不同的动效节奏 */
  variant?: 'home' | 'page' | 'section';
}

export default function InteractiveTitle({
  text,
  as = 'h1',
  className = '',
  variant = 'page',
}: InteractiveTitleProps) {
  const Tag = as;
  const chars = Array.from(text);

  return (
    <Tag
      className={`interactive-title interactive-title-${variant} font-display font-light tracking-wide text-ink ${className}`}
      aria-label={text}
    >
      <span className="interactive-title-inner" aria-hidden="true">
        {chars.map((char, index) => (
          <span
            key={`${char}-${index}`}
            className="interactive-title-char"
            style={{ ['--i' as string]: index }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </span>
      <span className="interactive-title-shine" aria-hidden="true" />
    </Tag>
  );
}
