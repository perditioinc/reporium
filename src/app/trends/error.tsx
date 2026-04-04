'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold text-zinc-200">Something went wrong</h2>
      <p className="text-sm text-zinc-400">An unexpected error occurred. Please try again.</p>
      <button
        onClick={reset}
        className="rounded-md bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
