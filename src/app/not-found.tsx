import Link from 'next/link';
import type { Metadata } from 'next';

// KAN-162: a project-level not-found.tsx is required for Next.js App Router to
// emit HTTP 404 (instead of HTTP 200) when `notFound()` is invoked from a
// server component / page. Without this file the runtime renders the built-in
// not-found UI but the response status falls back to 200 on prerendered + ISR
// routes (observed on /repo/[name] for private/missing slugs).
//
// The body intentionally avoids echoing any URL slug — see KAN-131 (#289) for
// the matching defense in /repo/[name]/page.tsx generateMetadata().
export const metadata: Metadata = {
  title: 'Not found | Reporium',
  description: 'The page you requested could not be found.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">
        404
      </p>
      <h1 className="text-2xl font-semibold text-zinc-100">Page not found</h1>
      <p className="max-w-md text-sm text-zinc-400">
        The page you requested isn&apos;t available. It may have been moved, the
        repository may be private, or the URL may be incorrect.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
      >
        Back to library
      </Link>
    </div>
  );
}
