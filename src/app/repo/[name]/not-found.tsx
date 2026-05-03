import Link from 'next/link';
import type { Metadata } from 'next';

// KAN-164: completes KAN-162's incomplete 404 fix.
//
// The app-level src/app/not-found.tsx (KAN-162) made the body render the 404
// page correctly, but in Next.js 16 static export with prerender the HTTP
// status for /repo/[name]/<missing-or-private> stayed 200. The fix is to
// place a not-found.tsx AT THE ROUTE SEGMENT — Next.js then propagates the
// 404 status through prerender for that route's notFound() calls.
//
// The body intentionally avoids echoing any URL slug — see KAN-131 (#289)
// for the matching defense in /repo/[name]/page.tsx generateMetadata().
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
