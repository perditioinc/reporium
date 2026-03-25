'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Mini ask input on the library home — navigates to /ask?q=... */
export function MiniAskBar() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  function navigate() {
    const q = query.trim();
    if (!q) return;
    router.push(`/ask?q=${encodeURIComponent(q)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      navigate();
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm select-none">
            ✦
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about AI dev tools..."
            maxLength={500}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-8 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
        <button
          type="button"
          onClick={navigate}
          className="shrink-0 rounded-lg bg-zinc-700 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-600 transition-colors"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
