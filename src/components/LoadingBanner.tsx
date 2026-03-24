'use client';

interface LoadingBannerProps {
  visible: boolean;
}

/**
 * Subtle top banner shown during Stage 2 (full library fetch).
 * Fades in/out without disrupting already-loaded content below.
 */
export function LoadingBanner({ visible }: LoadingBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading full library"
      className={[
        'w-full flex items-center justify-center gap-2.5 py-2 px-4',
        'bg-zinc-900/80 border-b border-zinc-800 text-xs text-zinc-400',
        'transition-all duration-500 ease-in-out overflow-hidden',
        visible ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0 border-b-0 py-0',
      ].join(' ')}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
      </span>
      <span>Loading full library (1,400+ repos)…</span>
    </div>
  );
}
