import { cn } from "@/lib/utils";

/**
 * SmArchitect mark — a hexagonal node (the universal "cloud service" shape) with
 * three connected edges forming a subtle upward arrow ("structured systems,
 * built up"). Monoline, works at favicon size.
 */
export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="sm-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(213 94% 68%)" />
          <stop offset="1" stopColor="hsl(224 90% 56%)" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.6 L27.2 9 V23 L16 29.4 L4.8 23 V9 Z"
        stroke="url(#sm-grad)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="hsl(213 94% 62% / 0.08)"
      />
      {/* upward arrow formed by three edges */}
      <path
        d="M9.5 20 L16 11 L22.5 20"
        stroke="url(#sm-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="11" r="2.1" fill="hsl(213 94% 66%)" />
      <circle cx="9.5" cy="20" r="1.7" fill="hsl(224 90% 60%)" />
      <circle cx="22.5" cy="20" r="1.7" fill="hsl(224 90% 60%)" />
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
  size = 28,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-tight">
          <span className="font-medium">Sm</span>
          <span className="font-semibold">Architect</span>
        </span>
      )}
    </div>
  );
}
