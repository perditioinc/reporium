'use client';

/**
 * KAN-57 — 16-category filter bar using DB primary_category field.
 * Shows a horizontal scrollable row of chips, one per category.
 * Clicking a chip sets ?category=<id> and filters the repo grid.
 */

import { useMemo } from 'react';
import { EnrichedRepo } from '@/types/repo';
import { getCategoryColor } from '@/lib/categoryColors';

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
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-2">
        {/* All chip */}
        <button
          onClick={() => onSelect('')}
          className={[
            'flex-shrink-0 flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-all',
            !selected
              ? 'bg-zinc-700 text-zinc-100 ring-1 ring-zinc-600'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800',
          ].join(' ')}
        >
          All
          <span className="text-[10px] sm:text-xs text-zinc-400">{totalRepos.toLocaleString()}</span>
        </button>

        {/* Divider */}
        <div className="flex-shrink-0 w-px h-4 sm:h-5 bg-zinc-700" />

        {/* Category chips — color coded per category */}
        {chips.map(cat => {
          const isActive = selected === cat.id;
          const catColor = getCategoryColor(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(isActive ? '' : cat.id)}
              className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-all whitespace-nowrap"
              style={
                isActive
                  ? {
                      backgroundColor: `color-mix(in srgb, ${catColor} 22%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${catColor} 65%, transparent)`,
                      color: catColor,
                    }
                  : {
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: '#a1a1aa',
                    }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.border = `1px solid color-mix(in srgb, ${catColor} 40%, transparent)`;
                  (e.currentTarget as HTMLElement).style.color = '#e4e4e7';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.14)';
                  (e.currentTarget as HTMLElement).style.color = '#a1a1aa';
                }
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span
                className="text-[10px] sm:text-xs"
                style={{ opacity: isActive ? 0.75 : 0.6 }}
              >
                {cat.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
