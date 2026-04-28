export default function Loading() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="space-y-2">
          <div className="h-5 w-32 animate-pulse rounded bg-zinc-800" />
          <div className="h-8 w-56 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-full max-w-xl animate-pulse rounded bg-zinc-900" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
              <div className="h-3 w-full animate-pulse rounded bg-zinc-800" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-800" />
              <div className="flex gap-2">
                <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-800" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
