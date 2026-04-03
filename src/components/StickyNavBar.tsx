'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/graph', label: 'Graph' },
  { href: '/trends', label: 'Trends' },
  { href: '/insights', label: 'Insights' },
  { href: '/stacks', label: 'Stacks' },
  { href: '/taxonomy', label: 'Taxonomy' },
  { href: '/wiki', label: 'Wiki' },
  { href: '/runs', label: 'Runs' },
];

interface StickyNavBarProps {
  /** Optional widget tabs rendered below the nav (home page only) */
  widgetTabs?: React.ReactNode;
}

function getScrollEl(): Element | null {
  return document.querySelector('.overflow-y-auto');
}

export function StickyNavBar({ widgetTabs }: StickyNavBarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = getScrollEl();
    if (el) {
      setAtTop(el.scrollTop <= 2);
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
    } else {
      setAtTop(window.scrollY <= 2);
      setAtBottom(window.innerHeight + window.scrollY >= document.body.scrollHeight - 2);
    }
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = getScrollEl();
    const target = el ?? window;
    target.addEventListener('scroll', updateScrollState, { passive: true });
    return () => target.removeEventListener('scroll', updateScrollState);
  }, [updateScrollState]);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const scrollToTop = () => {
    const el = getScrollEl();
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    const el = getScrollEl();
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const isHome = pathname === '/';

  return (
    <nav className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800">
      <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 h-10">
        {/* Logo — doubles as home link */}
        <Link
          href="/"
          className={`text-sm font-bold transition-colors shrink-0 ${
            isHome ? 'text-purple-300' : 'text-zinc-100 hover:text-white'
          }`}
        >
          Reporium
        </Link>

        {/* Desktop page links */}
        <div className="hidden sm:flex items-center gap-1 overflow-x-auto">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-purple-300 bg-purple-500/10'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Scroll shortcuts — hide when at boundary */}
          {!atTop && (
            <button
              onClick={scrollToTop}
              className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors"
              aria-label="Go to top"
              title="Go to top"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          )}
          {!atBottom && (
            <button
              onClick={scrollToBottom}
              className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors"
              aria-label="Go to bottom"
              title="Go to bottom"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </button>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="sm:hidden p-1 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-zinc-800 bg-zinc-950/98 backdrop-blur-sm px-3 py-2 space-y-0.5">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-purple-300 bg-purple-500/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Optional widget tabs (home page only) */}
      {widgetTabs}
    </nav>
  );
}
