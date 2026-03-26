'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Mini ask input on the library home — navigates to /ask?q=... */
export function MiniAskBar() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
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
    <div
      className={[
        'relative rounded-2xl p-[1px] transition-all duration-300',
        focused
          ? 'bg-gradient-to-r from-blue-500/40 via-purple-500/40 to-pink-500/40 shadow-lg shadow-blue-500/10'
          : 'bg-gradient-to-r from-zinc-700/50 via-zinc-600/30 to-zinc-700/50',
      ].join(' ')}
    >
      {/* Glassy inner container */}
      <div className="rounded-2xl bg-zinc-900/80 backdrop-blur-xl p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none">
              <span className={`transition-colors duration-300 ${focused ? 'text-blue-400' : 'text-zinc-500'}`}>✦</span>
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Ask a question about AI dev tools..."
              maxLength={500}
              className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/50 backdrop-blur-sm py-2.5 pl-8 pr-4 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-blue-500/40 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
            />
          </div>
          <button
            type="button"
            onClick={navigate}
            className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600/80 to-purple-600/80 px-5 py-2.5 text-sm font-medium text-white hover:from-blue-500/90 hover:to-purple-500/90 transition-all duration-200 shadow-sm"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
