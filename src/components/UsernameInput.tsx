'use client';

import { useState } from 'react';

interface UsernameInputProps {
  currentUsername: string;
  isLoading: boolean;
  onSubmit: (username: string) => void;
}

/** Input to explore any GitHub username */
export function UsernameInput({ currentUsername, isLoading, onSubmit }: UsernameInputProps) {
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && trimmed !== currentUsername) {
      onSubmit(trimmed);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Explore another user..."
        className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
      />
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
      >
        {isLoading ? 'Loading…' : 'Go'}
      </button>
    </form>
  );
}
