'use client';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  resultCount: number;
  totalCount: number;
}

/** Full-text search across repo names and descriptions */
export function SearchBar({ value, onChange, resultCount, totalCount }: SearchBarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
          🔍
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search repos..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        />
      </div>
      <span className="shrink-0 text-xs text-zinc-500">
        {resultCount} of {totalCount}
      </span>
    </div>
  );
}
