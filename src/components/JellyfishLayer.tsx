'use client';

import { useEffect, useState } from 'react';

/**
 * Jellyfish ambient layer for the home banner.
 *
 * Renders 3-5 translucent SVG jellyfish behind the billboard text.
 * Each jellyfish bobs vertically and drifts horizontally via CSS keyframes.
 * Tentacles wobble using a separate CSS animation on their paths.
 *
 * Design goals:
 * - Pure CSS keyframe animations — no JS per frame
 * - pointer-events:none, sits behind all text content
 * - prefers-reduced-motion: renders static (no animation)
 * - Mobile: 3 jellyfish; desktop: 5
 */

type JellyDef = {
  id: number;
  x: number;          // % left
  y: number;          // % top (within container)
  scale: number;      // 0.5–1.0
  delay: number;      // s
  bobDuration: number;  // s for vertical bob cycle
  driftDuration: number;
  driftX: number;     // px range for horizontal drift
  opacity: number;
  hue: number;        // hue-rotate degrees for color variation
};

function makeJellies(count: number): JellyDef[] {
  const positions = [12, 30, 50, 68, 84];
  return positions.slice(0, count).map((x, i) => ({
    id: i,
    x,
    y: 5 + ((i * 13 + 7) % 35),
    scale: 0.55 + ((i * 7 + 3) % 10) / 22,
    delay: -(i * 3.1 + 1.5),
    bobDuration: 7 + ((i * 2.3) % 5),
    driftDuration: 18 + ((i * 4.1) % 10),
    driftX: 16 + ((i * 5) % 20) * (i % 2 === 0 ? 1 : -1),
    opacity: 0.22 + ((i * 5) % 12) / 100,
    hue: [0, 20, -15, 30, -25][i] ?? 0,
  }));
}

/** Single jellyfish SVG — translucent bluish-purple bell with tentacles */
function Jellyfish({ size = 60 }: { size?: number }) {
  const r = size / 2;
  const bellH = size * 0.55;

  // Tentacle end-points — 8 tentacles hanging from bell rim
  const tentacles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI; // 0..π (bottom half of bell)
    const startX = r + Math.cos(angle) * r * 0.85;
    const startY = bellH;
    const endX = startX + (Math.random() > 0.5 ? 1 : -1) * (4 + (i % 5) * 3);
    const endY = startY + size * 0.55 + (i % 3) * 8;
    const cp1X = startX + ((i % 3) - 1) * 8;
    const cp1Y = startY + size * 0.18;
    const cp2X = endX + ((i % 2) - 0.5) * 12;
    const cp2Y = endY - size * 0.1;
    return { i, startX, startY, endX, endY, cp1X, cp1Y, cp2X, cp2Y };
  });

  const totalH = bellH + size * 0.6;

  return (
    <svg
      width={size}
      height={totalH}
      viewBox={`0 0 ${size} ${totalH}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="jbell" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="rgba(216,180,254,0.55)" />
          <stop offset="55%" stopColor="rgba(139,92,246,0.30)" />
          <stop offset="100%" stopColor="rgba(91,33,182,0.08)" />
        </radialGradient>
        <radialGradient id="jglow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="rgba(196,181,253,0.35)" />
          <stop offset="100%" stopColor="rgba(109,40,217,0)" />
        </radialGradient>
        {/* Soft inner highlight */}
        <radialGradient id="jhighlight" cx="38%" cy="28%" r="35%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.30)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* Outer glow halo */}
      <ellipse
        cx={r}
        cy={bellH * 0.5}
        rx={r * 1.15}
        ry={bellH * 0.65}
        fill="url(#jglow)"
      />

      {/* Bell body */}
      <path
        d={`M ${r * 0.05},${bellH} Q 0,${bellH * 0.3} ${r},0 Q ${size},${bellH * 0.3} ${size * 0.95},${bellH} Q ${r},${bellH * 1.12} ${r * 0.05},${bellH} Z`}
        fill="url(#jbell)"
        stroke="rgba(196,181,253,0.35)"
        strokeWidth="0.75"
      />

      {/* Inner highlight */}
      <path
        d={`M ${r * 0.3},${bellH * 0.7} Q ${r * 0.22},${bellH * 0.3} ${r * 0.55},${bellH * 0.05} Q ${r * 0.7},${bellH * 0.25} ${r * 0.62},${bellH * 0.72} Z`}
        fill="url(#jhighlight)"
      />

      {/* Inner ribs — gives translucent depth */}
      {[0.3, 0.5, 0.7].map((t) => (
        <path
          key={t}
          d={`M ${r * (0.15 + t * 0.05)},${bellH * 0.92} Q ${r * (t * 1.1)},${bellH * 0.35} ${r * (0.38 + t * 0.5)},${bellH * 0.04}`}
          stroke="rgba(196,181,253,0.18)"
          strokeWidth="0.5"
          fill="none"
        />
      ))}

      {/* Tentacles */}
      {tentacles.map((t) => (
        <path
          key={t.i}
          className="jelly-tentacle"
          d={`M ${t.startX},${t.startY} C ${t.cp1X},${t.cp1Y} ${t.cp2X},${t.cp2Y} ${t.endX},${t.endY}`}
          stroke="rgba(167,139,250,0.45)"
          strokeWidth="0.8"
          fill="none"
          strokeLinecap="round"
          style={{
            animationDelay: `${t.i * -0.7}s`,
          }}
        />
      ))}
    </svg>
  );
}

export function JellyfishLayer() {
  const [jellies, setJellies] = useState<JellyDef[]>([]);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setReduced(true);
      // Still render static jellyfish — just no animation
    }
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);

    const count = window.innerWidth < 768 ? 3 : 5;
    setJellies(makeJellies(count));

    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (jellies.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {jellies.map((j) => (
        <div
          key={j.id}
          className="jelly-wrap absolute"
          style={{
            left: `${j.x}%`,
            top: `${j.y}%`,
            transform: `scale(${j.scale})`,
            transformOrigin: 'top center',
            opacity: j.opacity,
            filter: `hue-rotate(${j.hue}deg)`,
            animationDelay: `${j.delay}s`,
            animationDuration: `${j.bobDuration}s`,
            animationPlayState: reduced ? 'paused' : 'running',
            // @ts-expect-error CSS custom property
            '--jelly-drift': `${j.driftX}px`,
          }}
        >
          <Jellyfish size={64} />
        </div>
      ))}

      <style jsx>{`
        .jelly-wrap {
          animation: jelly-float ease-in-out infinite;
        }

        @keyframes jelly-float {
          0%   { transform: translateY(0px)   translateX(0px); }
          25%  { transform: translateY(8px)   translateX(var(--jelly-drift, 14px)); }
          50%  { transform: translateY(14px)  translateX(0px); }
          75%  { transform: translateY(6px)   translateX(calc(var(--jelly-drift, 14px) * -0.6)); }
          100% { transform: translateY(0px)   translateX(0px); }
        }

        /* Tentacle wobble */
        .jelly-tentacle {
          animation: tentacle-sway 3.5s ease-in-out infinite alternate;
          transform-origin: top center;
        }

        @keyframes tentacle-sway {
          0%   { transform: skewX(-4deg) scaleX(0.96); }
          100% { transform: skewX(4deg)  scaleX(1.04); }
        }

        @media (prefers-reduced-motion: reduce) {
          .jelly-wrap,
          .jelly-tentacle {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
