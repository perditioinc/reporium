'use client';

import React from 'react';

interface SlideDotsProps {
  total: number;
  active: number;
  onDotClick: (index: number) => void;
  labels?: string[];
}

export function SlideDots({ total, active, onDotClick, labels = [] }: SlideDotsProps) {
  return (
    <nav
      aria-label="Slide navigation"
      className="fixed right-4 sm:right-6 top-1/2 z-50 -translate-y-1/2 flex flex-col gap-3"
    >
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onDotClick(i)}
          aria-label={labels[i] ?? `Go to slide ${i + 1}`}
          aria-current={i === active ? 'step' : undefined}
          className="group relative flex items-center justify-end"
        >
          {/* Tooltip label on hover */}
          <span className="pointer-events-none absolute right-6 whitespace-nowrap rounded bg-zinc-900 px-2 py-0.5 text-[10px] font-mono text-zinc-300 opacity-0 ring-1 ring-zinc-700 transition-opacity group-hover:opacity-100">
            {labels[i] ?? `${i + 1}`}
          </span>
          <span
            className={`block rounded-full transition-all duration-300 ${
              i === active
                ? 'h-3 w-3 bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]'
                : 'h-2 w-2 bg-zinc-600 hover:bg-zinc-400'
            }`}
          />
        </button>
      ))}
    </nav>
  );
}
