'use client';

import { useEffect, useState } from 'react';
import { createDataProvider } from '@/lib/dataProvider';

interface RepoEvaluation {
  pros: string[];
  cons: string[];
  best_for: string;
  avoid_if: string;
  comparable_to: string[];
  community_verdict: string;
}

interface Props {
  repoName: string;
}

/**
 * ADR-005: extracted from /repo/[name]/page.tsx server body so the page no
 * longer pays for `getRepoEvaluation` at build time. The panel renders a
 * skeleton until the API call resolves; if the data provider has no
 * evaluation method (lite mode), the panel renders nothing.
 */
export function RepoEvaluationPanel({ repoName }: Props) {
  const [evaluation, setEvaluation] = useState<RepoEvaluation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const provider = createDataProvider();
    const providerWithEval = provider as typeof provider & {
      getRepoEvaluation?: (name: string) => Promise<RepoEvaluation | null>;
    };
    let cancelled = false;
    if (typeof providerWithEval.getRepoEvaluation !== 'function') {
      Promise.resolve().then(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    providerWithEval
      .getRepoEvaluation(repoName)
      .then((result) => {
        if (!cancelled) setEvaluation(result);
      })
      .catch(() => {
        if (!cancelled) setEvaluation(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repoName]);

  if (loading) {
    return (
      <section
        className="rounded-[24px] border border-zinc-800 bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-950/60 p-5"
        aria-busy="true"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">Community Evaluation</h2>
          <span className="text-xs text-zinc-500">Loading…</span>
        </div>
        <div className="mt-4 space-y-3" aria-hidden="true">
          <div className="h-3 w-3/4 rounded bg-zinc-800/70" />
          <div className="h-3 w-2/3 rounded bg-zinc-800/70" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="h-20 rounded-xl bg-zinc-800/40" />
            <div className="h-20 rounded-xl bg-zinc-800/40" />
          </div>
        </div>
      </section>
    );
  }

  if (!evaluation) return null;

  return (
    <section className="rounded-[24px] border border-zinc-800 bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-950/60 p-5">
      <h2 className="text-lg font-semibold text-zinc-100">Community Evaluation</h2>
      {evaluation.community_verdict && (
        <p className="mt-3 text-sm leading-7 text-zinc-300 italic">
          &ldquo;{evaluation.community_verdict}&rdquo;
        </p>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {evaluation.pros?.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-emerald-400">Pros</p>
            <ul className="space-y-2">
              {evaluation.pros.map((pro, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {evaluation.cons?.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-red-400">Cons</p>
            <ul className="space-y-2">
              {evaluation.cons.map((con, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="mt-0.5 text-red-500">✕</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {evaluation.best_for && (
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-400">Best for</p>
            <p className="mt-1.5 text-sm text-zinc-300">{evaluation.best_for}</p>
          </div>
        )}
        {evaluation.avoid_if && (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-red-400">Avoid if</p>
            <p className="mt-1.5 text-sm text-zinc-300">{evaluation.avoid_if}</p>
          </div>
        )}
      </div>

      {evaluation.comparable_to?.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Comparable to</p>
          <div className="flex flex-wrap gap-2">
            {evaluation.comparable_to.map((alt) => (
              <span
                key={alt}
                className="rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-xs text-zinc-300"
              >
                {alt}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
