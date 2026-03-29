import type { QualitySignals } from '@/types/repo';

function badgeClasses(score: number): string {
  if (score >= 80) return 'border-emerald-700/40 bg-emerald-900/40 text-emerald-300';
  if (score >= 50) return 'border-amber-700/40 bg-amber-900/40 text-amber-300';
  return 'border-red-700/40 bg-red-900/40 text-red-300';
}

const MATURITY_CONFIG: Record<string, { label: string; cls: string }> = {
  production: { label: 'production',  cls: 'border-emerald-700/40 bg-emerald-900/40 text-emerald-300' },
  beta:       { label: 'beta',        cls: 'border-blue-700/40 bg-blue-900/40 text-blue-300' },
  prototype:  { label: 'prototype',   cls: 'border-amber-700/40 bg-amber-900/40 text-amber-300' },
  research:   { label: 'research',    cls: 'border-zinc-700/40 bg-zinc-800/40 text-zinc-400' },
};

export function QualityBadge({ quality }: { quality: QualitySignals | null | undefined }) {
  if (!quality) return null;

  const hasScore = typeof quality.overall_score === 'number';
  const maturity = quality.maturity;
  const maturityCfg = maturity ? MATURITY_CONFIG[maturity] : null;

  if (!hasScore && !maturityCfg) return null;

  return (
    <>
      {hasScore && (
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClasses(quality.overall_score!)}`}
          title={`Overall quality score: ${quality.overall_score}`}
        >
          Quality {Math.round(quality.overall_score!)}
        </span>
      )}
      {maturityCfg && (
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${maturityCfg.cls}`}
          title={`Maturity: ${maturity}`}
        >
          {maturityCfg.label}
        </span>
      )}
    </>
  );
}
