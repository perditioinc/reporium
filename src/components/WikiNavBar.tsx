import Link from 'next/link';

interface WikiNavBarProps {
  title?: string;
}

/** Top navigation bar for all wiki pages */
export function WikiNavBar({ title }: WikiNavBarProps) {
  return (
    <nav className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <span>←</span>
        <span>Back to Library</span>
      </Link>

      <span className="text-xs text-zinc-600 font-medium hidden sm:block">
        {title ?? 'Reporium Wiki'}
      </span>

      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <Link href="/ask" className="hover:text-zinc-300 transition-colors">Ask</Link>
        <Link href="/runs" className="hover:text-zinc-300 transition-colors">Run History</Link>
        <Link href="/taxonomy" className="hover:text-zinc-300 transition-colors">Taxonomy</Link>
        <span>☰ <Link href="/wiki" className="hover:text-zinc-300 transition-colors">Wiki</Link></span>
      </div>
    </nav>
  );
}
