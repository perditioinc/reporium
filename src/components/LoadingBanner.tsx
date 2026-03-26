'use client';

import type { LoadProgress } from '@/lib/dataProvider';

interface LoadingBannerProps {
  visible: boolean;
  progress?: LoadProgress | null;
}

/**
 * Top banner with a real progress bar shown during data loading.
 * Shows the current stage and percentage so users know what's happening.
 */
export function LoadingBanner({ visible, progress }: LoadingBannerProps) {
  const percent = progress?.percent ?? 0;
  const detail = progress?.detail ?? 'Loading…';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading full library"
      className={[
        'w-full flex flex-col gap-1 py-2 px-4',
        'bg-zinc-900/80 border-b border-zinc-800',
        'transition-all duration-500 ease-in-out overflow-hidden',
        visible ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0 border-b-0 py-0',
      ].join(' ')}
    >
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{detail}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      {/* Progress bar track */}
      <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
