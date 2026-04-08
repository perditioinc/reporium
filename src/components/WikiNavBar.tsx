import Link from 'next/link';

interface WikiNavBarProps {
  title?: string;
}

/**
 * Slim breadcrumb bar for detail / wiki pages.
 * StickyNavBar (from LayoutShell) already provides all primary navigation —
 * this component only adds a contextual back-link and a page title.
 */
export function WikiNavBar({ title }: WikiNavBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 py-2 border-b border-zinc-800/60 bg-zinc-950/80 text-xs text-zinc-500">
      <Link
        href="/"
        className="flex items-center gap-1 hover:text-zinc-300 transition-colors shrink-0"
      >
        <span>←</span>
        <span>Library</span>
      </Link>
      {title && (
        <>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400 truncate">{title}</span>
        </>
      )}
    </div>
  );
}
