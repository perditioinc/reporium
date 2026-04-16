'use client';

import { useEffect, useState } from 'react';

/**
 * Site-wide ambient bubble layer — small translucent circles that rise from
 * the bottom of the viewport with gentle horizontal sway.
 *
 * Design goals:
 * - Pure CSS keyframe animations (GPU-compositable, no JS per frame)
 * - pointer-events:none + aria-hidden so it never intercepts clicks
 * - Respects prefers-reduced-motion (skips entirely)
 * - Mobile: ~6 bubbles max; desktop: ~14 max
 * - Pauses via animation-play-state when page is hidden
 */

type BubbleDef = {
  id: number;
  size: number;       // px
  left: number;       // % of viewport width
  delay: number;      // animation-delay, s
  duration: number;   // animation-duration, s
  drift: number;      // horizontal drift amplitude, px (positive = right)
  opacity: number;
};

function makeBubbles(count: number): BubbleDef[] {
  // Deterministic-ish spread: evenly space left positions with jitter
  return Array.from({ length: count }, (_, i) => {
    const spread = 100 / count;
    return {
      id: i,
      size: 6 + Math.floor(((i * 7 + 3) % 11) + ((i * 13) % 7)),
      left: spread * i + (((i * 17 + 5) % 10) / 10) * spread,
      delay: -(((i * 3.7) % 18) + 1),   // negative = already mid-animation on mount
      duration: 14 + ((i * 4.3) % 12),
      drift: ((i % 2 === 0 ? 1 : -1) * (12 + ((i * 5) % 24))),
      opacity: 0.10 + ((i * 3) % 8) / 100,
    };
  });
}

export function AmbientBubbles() {
  const [bubbles, setBubbles] = useState<BubbleDef[]>([]);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setReduced(true);
      return;
    }
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);

    const count = window.innerWidth < 768 ? 6 : 14;
    setBubbles(makeBubbles(count));

    function onVis() {
      setPaused(document.visibilityState === 'hidden');
    }
    document.addEventListener('visibilitychange', onVis);

    return () => {
      mq.removeEventListener('change', onChange);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  if (reduced || bubbles.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="amb-bubble absolute bottom-0 rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.left}%`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
            animationPlayState: paused ? 'paused' : 'running',
            opacity: b.opacity,
            // @ts-expect-error CSS custom property
            '--amb-drift': `${b.drift}px`,
          }}
        />
      ))}

      <style jsx>{`
        .amb-bubble {
          background: radial-gradient(
            circle at 35% 30%,
            rgba(165, 243, 252, 0.85),
            rgba(103, 232, 249, 0.45) 50%,
            rgba(34, 211, 238, 0) 75%
          );
          border: 1px solid rgba(165, 243, 252, 0.25);
          animation: amb-rise linear infinite;
          will-change: transform;
        }

        @keyframes amb-rise {
          0% {
            transform: translateY(0) translateX(0) scale(1);
            opacity: var(--base-opacity, 0.12);
          }
          25% {
            transform: translateY(-25vh) translateX(var(--amb-drift, 14px)) scale(1.05);
          }
          50% {
            transform: translateY(-50vh) translateX(0) scale(0.95);
          }
          75% {
            transform: translateY(-75vh) translateX(calc(var(--amb-drift, 14px) * -0.5)) scale(1.03);
          }
          100% {
            transform: translateY(-105vh) translateX(0) scale(0.8);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
