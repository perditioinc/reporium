'use client';

/**
 * KAN-57 — 16-category filter bar using DB primary_category field.
 * Shows a horizontal scrollable row of chips, one per category.
 * Clicking a chip sets ?category=<id> and filters the repo grid.
 */

import { useMemo } from 'react';
import { EnrichedRepo } from '@/types/repo';

interface CategoryChip {
  id: string;
  label: string;
  icon: string;
  count: number;
}

const DB_CATEGORIES: Omit<CategoryChip, 'count'>[] = [
  { id: 'agents',           label: 'Agents',          icon: '🤖' },
  { id: 'rag-retrieval',    label: 'RAG & Retrieval',  icon: '🔍' },
  { id: 'llm-serving',      label: 'LLM Serving',      icon: '⚡' },
  { id: 'fine-tuning',      label: 'Fine-tuning',      icon: '🎯' },
  { id: 'evaluation',       label: 'Evaluation',       icon: '📊' },
  { id: 'orchestration',    label: 'Orchestration',    icon: '🔀' },
  { id: 'vector-databases', label: 'Vector DBs',       icon: '🗄️' },
  { id: 'observability',    label: 'Observability',    icon: '👁️' },
  { id: 'security-safety',  label: 'Security & Safety',icon: '🔒' },
  { id: 'code-generation',  label: 'Code Gen',         icon: '💻' },
  { id: 'data-processing',  label: 'Data Processing',  icon: '⚙️' },
  { id: 'computer-vision',  label: 'Computer Vision',  icon: '👁' },
  { id: 'nlp-text',         label: 'NLP & Text',       icon: '📝' },
  { id: 'speech-audio',     label: 'Speech & Audio',   icon: '🎙️' },
  { id: 'generative-media', label: 'Generative Media', icon: '🎨' },
  { id: 'infrastructure',   label: 'Infrastructure',   icon: '🏗️' },
];

interface Props {
  repos: EnrichedRepo[];
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryFilterBar({ repos, selected, onSelect }: Props) {
  const chips = useMemo<CategoryChip[]>(() => {
    const counts = new Map<string, number>();
    for (const repo of repos) {
      if (repo.dbCategory) {
        counts.set(repo.dbCategory, (counts.get(repo.dbCategory) ?? 0) + 1);
      }
    }
    return DB_CATEGORIES
      .map(cat => ({ ...cat, count: counts.get(cat.id) ?? 0 }))
      .filter(cat => cat.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [repos]);

  if (chips.length === 0) return null;

  const totalRepos = repos.filter(r => r.dbCategory).length;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {/* All chip */}
        <button
          onClick={() => onSelect('')}
          className={[
            'flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all',
            !selected
              ? 'bg-zinc-100 text-zinc-900 ring-1 ring-zinc-300'
              : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50',
          ].join(' ')}
        >
          All
          <span className="text-xs text-zinc-400">{totalRepos.toLocaleString()}</span>
        </button>

        {/* Divider */}
        <div className="flex-shrink-0 w-px h-5 bg-zinc-200" />

        {/* Category chips */}
        {chips.map(cat => {
          const isActive = selected === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(isActive ? '' : cat.id)}
              className={[
                'flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300'
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50',
              ].join(' ')}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className={`text-xs ${isActive ? 'text-indigo-400' : 'text-zinc-400'}`}>
                {cat.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
