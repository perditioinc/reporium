import type { QualitySignals } from '@/types/repo';

function badgeClasses(score: number): string {
  if (score >= 80) return 'border-emerald-700/40 bg-emerald-900/40 text-emerald-300';
  if (score >= 50) return 'border-amber-700/40 bg-amber-900/40 text-amber-300';
  return 'border-red-700/40 bg-red-900/40 text-red-300';
}

export function QualityBadge({ quality }: { quality: QualitySignals | null | undefined }) {
  if (!quality || typeof quality.overall_score !== 'number') return null;

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClasses(quality.overall_score)}`}
      title={`Overall quality score: ${quality.overall_score}`}
    >
      Quality {Math.round(quality.overall_score)}
    </span>
  );
}
