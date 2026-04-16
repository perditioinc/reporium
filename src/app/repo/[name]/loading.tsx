import { SkeletonBar, SkeletonCard } from '@/components/Skeleton';

/**
 * Shown instantly while /repo/[name] loads its data + heavy component tree.
 * Without this file, clicking "Open repo details" would show a blank screen
 * for 300-800ms while the JS bundle downloaded and hydrated.
 */
export default function RepoDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-2 w-2 animate-ping rounded-full bg-purple-400" />
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">
          Loading repo…
        </span>
      </div>

      {/* Hero card */}
      <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/60 p-6 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-3 w-14 rounded-full bg-zinc-800" />
          <div className="h-3 w-1 rounded bg-zinc-800" />
          <div className="h-3 w-24 rounded-full bg-zinc-800" />
          <div className="h-5 w-16 rounded-full bg-zinc-800" />
        </div>
        <div className="mt-4 h-8 w-2/3 rounded-md bg-zinc-800" />
        <div className="mt-3 h-4 w-full rounded-md bg-zinc-800/70" />
        <div className="mt-2 h-4 w-4/5 rounded-md bg-zinc-800/70" />
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3"
            >
              <SkeletonBar height="h-3" width="w-1/2" />
              <SkeletonBar height="h-6" width="w-1/3" className="mt-2" />
            </div>
          ))}
        </div>
      </div>

      {/* Body sections */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard className="lg:col-span-2" />
      </div>
    </div>
  );
}
