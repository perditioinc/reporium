'use client';

import React from 'react';

interface SlideProgressProps {
  current: number; // 0-indexed
  total: number;
}

export function SlideProgress({ current, total }: SlideProgressProps) {
  const pct = ((current + 1) / total) * 100;

  return (
    <div className="fixed top-0 left-0 z-50 h-[3px] w-full bg-zinc-900">
      <div
        className="h-full transition-all duration-500 ease-out"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #d946ef, #22d3ee)',
          boxShadow: '0 0 8px rgba(217,70,239,0.7), 0 0 16px rgba(34,211,238,0.4)',
        }}
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Slide ${current + 1} of ${total}`}
      />
    </div>
  );
}
