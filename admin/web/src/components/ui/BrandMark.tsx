export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="url(#brand-grad)" />
      <path
        d="M8 20 L16 8 L24 20"
        stroke="var(--color-bg)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="16" cy="22" r="2" fill="var(--color-bg)" />
      <defs>
        <linearGradient id="brand-grad" x1="4" y1="4" x2="28" y2="28">
          <stop stopColor="var(--color-accent)" />
          <stop offset="1" stopColor="var(--color-ice)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
