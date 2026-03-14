'use client';

/** Skeleton loading state for the repo grid */
export function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
        >
          <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
          <div className="h-3 w-full animate-pulse rounded bg-zinc-800" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-800" />
          <div className="flex gap-1.5">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-5 w-16 animate-pulse rounded-full bg-zinc-800" />
            ))}
          </div>
          <div className="flex gap-3">
            <div className="h-3 w-16 animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-12 animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
