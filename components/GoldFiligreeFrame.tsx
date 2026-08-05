/** 精致烫金纹路边框 —— 仅用于 Cover Art 页 */
export default function GoldFiligreeFrame() {
  const gold = {
    soft: '#e8d5a3',
    mid: '#c9a84c',
    deep: '#9a7b2f',
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden="true"
    >
      {/* 双线外框 */}
      <div
        className="absolute inset-0 rounded-sm"
        style={{
          border: `1px solid ${gold.mid}`,
          boxShadow: `inset 0 0 0 4px transparent, 0 0 0 1px ${gold.soft}44`,
          opacity: 0.85,
        }}
      />
      <div
        className="absolute inset-[5px] rounded-sm"
        style={{
          border: `1px solid ${gold.soft}`,
          opacity: 0.55,
        }}
      />

      {/* 四角烫金花纹 */}
      <Corner className="left-0 top-0" gold={gold} />
      <Corner className="right-0 top-0 scale-x-[-1]" gold={gold} />
      <Corner className="bottom-0 left-0 scale-y-[-1]" gold={gold} />
      <Corner
        className="bottom-0 right-0 scale-x-[-1] scale-y-[-1]"
        gold={gold}
      />

      {/* 四边中点小饰 */}
      <EdgeOrnament className="left-1/2 top-0 -translate-x-1/2" gold={gold} />
      <EdgeOrnament
        className="bottom-0 left-1/2 -translate-x-1/2 rotate-180"
        gold={gold}
      />
      <EdgeOrnament
        className="left-0 top-1/2 -translate-y-1/2 -rotate-90"
        gold={gold}
      />
      <EdgeOrnament
        className="right-0 top-1/2 -translate-y-1/2 rotate-90"
        gold={gold}
      />
    </div>
  );
}

function Corner({
  className,
  gold,
}: {
  className?: string;
  gold: { soft: string; mid: string; deep: string };
}) {
  return (
    <svg
      className={`absolute h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 ${className ?? ''}`}
      viewBox="0 0 100 100"
      fill="none"
    >
      {/* 外角弧线 */}
      <path
        d="M8 55 C8 28 28 8 55 8"
        stroke={gold.mid}
        strokeWidth="1.2"
        opacity="0.9"
      />
      <path
        d="M14 52 C14 32 32 14 52 14"
        stroke={gold.soft}
        strokeWidth="0.8"
        opacity="0.7"
      />

      {/* 卷草纹 */}
      <path
        d="M20 48 C18 36 28 22 42 20 C36 28 38 40 48 42 C36 40 28 48 20 48Z"
        stroke={gold.mid}
        strokeWidth="0.9"
        fill={`${gold.soft}22`}
        opacity="0.85"
      />
      <path
        d="M48 20 C50 32 40 46 26 48 C32 40 30 28 20 26 C32 28 40 20 48 20Z"
        stroke={gold.deep}
        strokeWidth="0.7"
        fill="none"
        opacity="0.65"
      />

      {/* 角点小菱形 */}
      <path
        d="M10 10 L14 6 L18 10 L14 14 Z"
        fill={gold.mid}
        opacity="0.9"
      />
      <circle cx="14" cy="14" r="1.2" fill={gold.soft} opacity="0.8" />

      {/* 延伸细线 */}
      <path
        d="M55 8 L78 8"
        stroke={gold.mid}
        strokeWidth="0.9"
        opacity="0.75"
      />
      <path
        d="M8 55 L8 78"
        stroke={gold.mid}
        strokeWidth="0.9"
        opacity="0.75"
      />
      <path
        d="M55 12 L72 12"
        stroke={gold.soft}
        strokeWidth="0.6"
        opacity="0.5"
      />
      <path
        d="M12 55 L12 72"
        stroke={gold.soft}
        strokeWidth="0.6"
        opacity="0.5"
      />
    </svg>
  );
}

function EdgeOrnament({
  className,
  gold,
}: {
  className?: string;
  gold: { soft: string; mid: string; deep: string };
}) {
  return (
    <svg
      className={`absolute h-6 w-16 sm:h-7 sm:w-20 ${className ?? ''}`}
      viewBox="0 0 80 28"
      fill="none"
    >
      <path
        d="M4 14 H28"
        stroke={gold.mid}
        strokeWidth="0.9"
        opacity="0.7"
      />
      <path
        d="M52 14 H76"
        stroke={gold.mid}
        strokeWidth="0.9"
        opacity="0.7"
      />
      <path
        d="M40 4 L46 14 L40 24 L34 14 Z"
        stroke={gold.mid}
        strokeWidth="0.9"
        fill={`${gold.soft}33`}
        opacity="0.9"
      />
      <circle cx="40" cy="14" r="2" fill={gold.deep} opacity="0.7" />
      <path
        d="M28 14 C32 8 36 8 40 14 C36 20 32 20 28 14Z"
        stroke={gold.soft}
        strokeWidth="0.7"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M52 14 C48 8 44 8 40 14 C44 20 48 20 52 14Z"
        stroke={gold.soft}
        strokeWidth="0.7"
        fill="none"
        opacity="0.6"
      />
    </svg>
  );
}
