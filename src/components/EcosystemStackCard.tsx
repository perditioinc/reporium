'use client';

import { useState } from 'react';
import { ACCENT_CLASSES, type EcosystemStack } from '@/data/ecosystemStacks';

interface EcosystemStackCardProps {
  stack: EcosystemStack;
  defaultExpanded?: boolean;
}

export function EcosystemStackCard({ stack, defaultExpanded = false }: EcosystemStackCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const accent = ACCENT_CLASSES[stack.accent] ?? ACCENT_CLASSES.blue;

  return (
    <div
      className={`rounded-xl border ${accent.border} ${expanded ? accent.bg : 'bg-zinc-900/40'} transition-colors`}
    >
      {/* Header — always visible */}
      <button
        className="w-full text-left px-5 py-4 flex items-start gap-4"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${stack.title} tech stack`}
      >
        {/* Icon */}
        <span className="text-2xl shrink-0 mt-0.5">{stack.icon}</span>

        {/* Title + tagline */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className={`text-base font-semibold ${accent.text}`}>{stack.title}</h2>
            <span className="shrink-0 text-zinc-600 text-sm">{expanded ? '▲' : '▼'}</span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">{stack.tagline}</p>

          {/* Tags */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stack.tags.map((tag) => (
              <span key={tag} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${accent.badge}`}>
                {tag}
              </span>
            ))}
          </div>

          {/* Repo pill preview when collapsed */}
          {!expanded && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stack.repos.map((repo) => (
                <span key={repo.upstream} className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-zinc-800 text-zinc-400">
                  {repo.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* What you build */}
          <p className="text-xs text-zinc-400 border-l-2 border-zinc-700 pl-3 leading-relaxed">
            {stack.whatYouBuild}
          </p>

          {/* Repo cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {stack.repos.map((repo) => {
              const ghUrl = `https://github.com/${repo.upstream}`;
              return (
                <a
                  key={repo.upstream}
                  href={ghUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-zinc-200 group-hover:text-white">
                        {repo.name}
                      </span>
                      <span className="ml-2 text-[10px] text-zinc-600 font-mono truncate">
                        {repo.upstream}
                      </span>
                    </div>
                    {repo.stars != null && (
                      <span className="shrink-0 text-xs text-zinc-600">
                        ★ {repo.stars >= 1000
                          ? `${(repo.stars / 1000).toFixed(repo.stars >= 10000 ? 0 : 1)}k`
                          : repo.stars}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
                    {repo.role}
                  </p>
                  <span className="mt-2 inline-block text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                    {repo.category}
                  </span>
                </a>
              );
            })}
          </div>

          {/* Search library link */}
          <a
            href={`/ask`}
            className={`inline-flex items-center gap-1.5 text-xs ${accent.text} hover:underline`}
          >
            ✦ Ask about this stack in the library
          </a>
        </div>
      )}
    </div>
  );
}
