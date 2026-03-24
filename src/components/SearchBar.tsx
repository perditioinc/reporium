'use client';

import type { SearchMode } from '@/lib/dataProvider';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  resultCount: number;
  totalCount: number;
  searchMode: SearchMode;
  onSearchModeChange: (mode: SearchMode) => void;
}

/** Search input with keyword/semantic mode toggle. */
export function SearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
  searchMode,
  onSearchModeChange,
}: SearchBarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="inline-flex w-fit rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        {(['keyword', 'semantic'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onSearchModeChange(mode)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              searchMode === mode
                ? 'bg-sky-900/40 text-sky-300'
                : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            {mode === 'keyword' ? 'Keyword' : 'Semantic'}
          </button>
        ))}
      </div>

      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
          🔍
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={searchMode === 'semantic' ? 'Search by meaning...' : 'Search repos...'}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        />
      </div>

      <span className="shrink-0 text-xs text-zinc-500">
        {resultCount} of {totalCount}
      </span>
    </div>
  );
}
