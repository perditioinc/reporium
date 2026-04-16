/**
 * Skeleton primitives for loading.tsx files across the app router.
 *
 * Kept as dumb server components so Next.js can stream them instantly from the
 * edge without a client-side hydration cost. Tailwind's animate-pulse is the
 * only animation — no JS needed.
 */

export function SkeletonBar({
  className = '',
  width = 'w-full',
  height = 'h-4',
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-800/60 ${width} ${height} ${className}`}
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 ${className}`}
    >
      <div className="h-4 w-1/3 rounded bg-zinc-800" />
      <div className="mt-3 h-3 w-full rounded bg-zinc-800/70" />
      <div className="mt-2 h-3 w-4/5 rounded bg-zinc-800/70" />
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-14 rounded-full bg-zinc-800/70" />
        <div className="h-5 w-20 rounded-full bg-zinc-800/70" />
        <div className="h-5 w-10 rounded-full bg-zinc-800/70" />
      </div>
    </div>
  );
}

export function SkeletonPage({
  title = 'Loading…',
  cards = 6,
}: {
  title?: string;
  cards?: number;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-2 w-2 animate-ping rounded-full bg-purple-400" />
        <h2 className="text-sm font-medium text-zinc-400">{title}</h2>
      </div>
      <SkeletonBar height="h-8" width="w-2/3" className="mb-2" />
      <SkeletonBar height="h-4" width="w-1/2" className="mb-8" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
