'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CATEGORIES } from '@/lib/buildCategories';
import { AI_DEV_SKILLS, KNOWN_ORGS } from '@/lib/buildTaxonomy';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const AI_DEV_SKILL_NAMES = Object.keys(AI_DEV_SKILLS);
const TOP_BUILDERS = Object.entries(KNOWN_ORGS)
  .map(([login, info]) => ({ login, ...info }))
  .slice(0, 15);

// Navigation tree
const NAV = [
  { title: 'Overview', href: '/wiki', icon: '📖' },
  {
    title: 'AI Dev Skills', icon: '⚡',
    children: AI_DEV_SKILL_NAMES.map(s => ({ title: s, href: `/wiki/skills/${slugify(s)}` }))
  },
  {
    title: 'Categories', icon: '🗂️',
    children: CATEGORIES.map(c => ({ title: c.name, href: `/wiki/categories/${c.id}` }))
  },
  {
    title: 'Builders', icon: '🏗️',
    children: TOP_BUILDERS.map(b => ({ title: b.displayName, href: `/wiki/builders/${b.login}` }))
  },
  { title: 'Daily Digest', href: '/wiki/digest', icon: '📋' },
  { title: 'Roadmap', href: '/wiki/roadmap', icon: '🗺️' },
] as const;

type NavItem = {
  title: string;
  icon: string;
  href?: string;
  children?: { title: string; href: string }[];
};

export function WikiSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['AI Dev Skills']));

  // Restore sidebar open state from localStorage after mount (initializing from external store)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('wiki-sidebar-open');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === 'true') setOpen(true);
    } catch {}
  }, []);

  function toggle() {
    setOpen(v => {
      try { localStorage.setItem('wiki-sidebar-open', String(!v)); } catch {}
      return !v;
    });
  }

  function toggleSection(title: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  return (
    <>
      {/* Hamburger button — always visible */}
      <button
        onClick={toggle}
        className="fixed top-4 left-4 z-50 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
        aria-label="Toggle wiki sidebar"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect y="2" width="16" height="2" rx="1"/>
          <rect y="7" width="16" height="2" rx="1"/>
          <rect y="12" width="16" height="2" rx="1"/>
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={toggle}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-zinc-950 border-r border-zinc-800 transform transition-transform duration-200 overflow-y-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
          <span className="text-zinc-100 font-bold text-sm">📚 Reporium Wiki</span>
          <button onClick={toggle} className="ml-auto text-zinc-500 hover:text-zinc-300">✕</button>
        </div>

        <nav className="p-2">
          {(NAV as unknown as NavItem[]).map(item => (
            <div key={item.title}>
              {item.href ? (
                <Link
                  href={item.href}
                  onClick={toggle}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    pathname === item.href
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.title}</span>
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => toggleSection(item.title)}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
                  >
                    <span>{item.icon}</span>
                    <span className="flex-1 text-left">{item.title}</span>
                    <span className="text-xs">{expandedSections.has(item.title) ? '▼' : '▶'}</span>
                  </button>
                  {expandedSections.has(item.title) && item.children && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {item.children.map(child => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={toggle}
                          className={`block px-3 py-1.5 rounded text-xs transition-colors ${
                            pathname === child.href
                              ? 'bg-zinc-800 text-zinc-100'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                          }`}
                        >
                          {child.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
