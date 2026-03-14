'use client';

import { useEffect, useState } from 'react';

interface RateLimitBannerProps {
  message: string;
  retryAfterSeconds: number;
  onRetry: () => void;
}

/** Friendly rate limit error banner with live countdown and retry button. */
export function RateLimitBanner({ message, retryAfterSeconds, onRetry }: RateLimitBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState(retryAfterSeconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryAfterSeconds]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const countdown =
    minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 p-5 text-sm">
      <div className="flex items-start gap-3">
        <span className="text-xl">⏳</span>
        <div className="flex-1 space-y-2">
          <p className="font-medium text-amber-300">GitHub API Rate Limit Reached</p>
          <p className="text-amber-400/80">
            {message} GitHub allows 60 requests/hour without a token, or 5,000/hour with one.
          </p>
          {secondsLeft > 0 ? (
            <p className="text-amber-500">
              Resets in{' '}
              <span className="font-mono font-semibold text-amber-300">{countdown}</span>
            </p>
          ) : (
            <button
              onClick={onRetry}
              className="mt-1 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-500 transition-colors"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
