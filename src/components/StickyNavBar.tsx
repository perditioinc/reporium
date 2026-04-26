'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Inline icon components — kept inline to avoid adding a dependency.
// Each is a 14x14 single-stroke svg matching the existing nav-bar icon style.
const NavIcon = {
  graph: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="12" cy="12" r="2" />
      <path d="M12 12L5 5M12 12L19 5M12 12L5 19M12 12L19 19" />
    </svg>
  ),
  wiki: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  taxonomy: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1" fill="currentColor" />
    </svg>
  ),
  stacks: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  insights: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.4 1 2.3h6c0-.9.3-1.7 1-2.3A7 7 0 0 0 12 2z" />
    </svg>
  ),
  trends: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  architecture: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  aiNative: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  faq: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
} as const;

const NAV_LINKS = [
  { href: '/graph',        label: 'Graph',        icon: NavIcon.graph        },
  { href: '/wiki',         label: 'Wiki',         icon: NavIcon.wiki         },
  { href: '/taxonomy',     label: 'Taxonomy',     icon: NavIcon.taxonomy     },
  { href: '/stacks',       label: 'Stacks',       icon: NavIcon.stacks       },
  { href: '/insights',     label: 'Insights',     icon: NavIcon.insights     },
  { href: '/trends',       label: 'Trends',       icon: NavIcon.trends       },
  { href: '/architecture', label: 'Architecture', icon: NavIcon.architecture },
  { href: '/ai-native',    label: 'AI-Native',    icon: NavIcon.aiNative     },
  { href: '/faq',          label: 'FAQ',          icon: NavIcon.faq          },
];

interface StickyNavBarProps {
  /** Optional widget tabs rendered below the nav (home page only) */
  widgetTabs?: React.ReactNode;
}

// Find the scroll container. The home page wraps content in a flex column
// with .overflow-y-auto on the inner pane; standalone pages just scroll
// the window. Re-queried on every interaction so the result stays fresh
// after route changes (the previous element may have unmounted).
function getScrollEl(): Element | null {
  if (typeof document === 'undefined') return null;
  // Take the first scrollable container with actual overflow — querying for
  // the bare class can match panes that don't actually scroll on this route.
  const candidates = Array.from(document.querySelectorAll('.overflow-y-auto'));
  for (const c of candidates) {
    if (c.scrollHeight > c.clientHeight + 2) return c;
  }
  return null;
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

  // Re-attach the scroll listener on every route change — the previous
  // scroll container may have unmounted, so the listener has to be rebound
  // against whatever the new page rendered.
  useEffect(() => {
    updateScrollState();
    const el = getScrollEl();
    const target: EventTarget = el ?? window;
    target.addEventListener('scroll', updateScrollState, { passive: true } as AddEventListenerOptions);
    window.addEventListener('resize', updateScrollState, { passive: true } as AddEventListenerOptions);
    return () => {
      target.removeEventListener('scroll', updateScrollState as EventListener);
      window.removeEventListener('resize', updateScrollState as EventListener);
    };
  }, [updateScrollState, pathname]);

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
    <nav
      className="sticky top-0 z-40 bg-zinc-950/95 md:bg-zinc-950/80 md:backdrop-blur-sm border-b border-zinc-800"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 h-10">
        {/* Logo + GitHub — doubles as home link */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/"
            className={`text-sm font-bold transition-colors ${
              isHome ? 'text-purple-300' : 'text-zinc-100 hover:text-white'
            }`}
          >
            Reporium
          </Link>
          <a
            href="https://github.com/perditioinc/reporium"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Reporium on GitHub"
            title="View Reporium on GitHub"
            className="inline-flex items-center justify-center rounded p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
              <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.53-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.07 0 0 .96-.31 3.15 1.18.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.49 3.15-1.18 3.15-1.18.62 1.6.23 2.78.11 3.07.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.41-5.27 5.69.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.67.8.56C20.71 21.38 24 17.08 24 12 24 5.73 18.77.5 12 .5z"/>
            </svg>
          </a>
          {/* Guided-tour trigger — navigates to home with ?utm_mode=guide so
              GuidedTour picks it up. If already on home, we dispatch a custom
              event the tour listens for, avoiding a full reload. */}
          <button
            type="button"
            aria-label="Start guided walkthrough"
            title="Start guided walkthrough"
            onClick={() => {
              if (window.location.pathname === '/') {
                const url = new URL(window.location.href);
                url.searchParams.set('utm_mode', 'guide');
                window.history.replaceState({}, '', url.pathname + url.search + url.hash);
                window.dispatchEvent(new CustomEvent('reporium:open-guide'));
              } else {
                window.location.href = '/?utm_mode=guide';
              }
            }}
            className="nav-help inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold transition-all"
          >
            ?
            <style jsx>{`
              .nav-help {
                border-color: rgba(240,171,252,0.5);
                color: #f0abfc;
                background: linear-gradient(135deg, rgba(217,70,239,0.12), rgba(34,211,238,0.12));
                box-shadow: 0 0 8px rgba(217,70,239,0.25);
                animation: nav-help-pulse 2.4s ease-in-out infinite;
              }
              .nav-help:hover {
                border-color: rgba(240,171,252,0.9);
                background: linear-gradient(135deg, rgba(217,70,239,0.25), rgba(34,211,238,0.25));
                box-shadow: 0 0 14px rgba(217,70,239,0.55), 0 0 24px rgba(34,211,238,0.35);
                color: #fdf4ff;
              }
              @keyframes nav-help-pulse {
                0%, 100% { box-shadow: 0 0 6px rgba(217,70,239,0.2); }
                50%      { box-shadow: 0 0 12px rgba(217,70,239,0.5), 0 0 20px rgba(34,211,238,0.25); }
              }
              @media (prefers-reduced-motion: reduce) {
                .nav-help { animation: none; }
              }
            `}</style>
          </button>
        </div>

        {/* Desktop page links */}
        <div className="hidden sm:flex items-center gap-1 overflow-x-auto">
          {NAV_LINKS.map(({ href, label, icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-purple-300 bg-purple-500/10'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <span className="shrink-0 opacity-80">{icon}</span>
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Scroll shortcuts — always rendered AND always clickable. The
              previous design disabled them at the boundaries, but on routes
              where the scroll container detection lost the listener after
              navigation the up arrow effectively disappeared (rendered with
              text-zinc-800 on a near-black background). Both buttons are now
              always live — clicking 'top' when already at top is a harmless
              no-op, and the 'at boundary' state only dims the colour subtly
              so the icons remain visible. */}
          <button
            onClick={scrollToTop}
            className={`p-1 rounded transition-colors ${
              atTop
                ? 'text-zinc-600 hover:text-zinc-300'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
            aria-label="Go to top"
            title="Go to top"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={scrollToBottom}
            className={`p-1 rounded transition-colors ${
              atBottom
                ? 'text-zinc-600 hover:text-zinc-300'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
            aria-label="Go to bottom"
            title="Go to bottom"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </button>

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
          {NAV_LINKS.map(({ href, label, icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-purple-300 bg-purple-500/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <span className="shrink-0 opacity-80">{icon}</span>
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
