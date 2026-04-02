// Design tokens — single source of truth for Reporium UI

// Spacing scale (4px base, matches Tailwind)
export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48, '3xl': 64 } as const;

// Typography
export const FONT = {
  family: { sans: 'Inter, system-ui, sans-serif', mono: 'JetBrains Mono, monospace' },
  size: { xs: '0.625rem', sm: '0.75rem', base: '0.875rem', lg: '1rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '2rem' },
  weight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  leading: { tight: 1.25, normal: 1.5, relaxed: 1.75 },
} as const;

// Semantic colors (dark theme)
export const COLOR = {
  bg: { void: '#0a0a0f', base: '#09090b', raised: '#18181b', overlay: '#27272a' },
  border: { subtle: '#27272a', default: '#3f3f46', strong: '#52525b' },
  text: { primary: '#f4f4f5', secondary: '#a1a1aa', muted: '#71717a', dim: '#52525b' },
  accent: { primary: '#8b5cf6', hover: '#7c3aed', subtle: 'rgba(139,92,246,0.1)' },
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  interactive: { default: '#3f3f46', hover: '#52525b', active: '#71717a' },
} as const;

// Border radii (standardized to 3 values)
export const RADIUS = { sm: '0.375rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', full: '9999px' } as const;

// Shadows
export const SHADOW = {
  sm: '0 1px 2px rgba(0,0,0,0.3)',
  md: '0 4px 6px rgba(0,0,0,0.3)',
  lg: '0 10px 15px rgba(0,0,0,0.4)',
  xl: '0 20px 25px rgba(0,0,0,0.5)',
} as const;

// Z-index scale
export const Z = { base: 0, dropdown: 10, sticky: 20, overlay: 30, modal: 40, toast: 50 } as const;

// Transitions
export const TRANSITION = {
  fast: '150ms ease-out',
  normal: '200ms ease-out',
  slow: '300ms ease-out',
} as const;

// Framer Motion spring presets
export const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 300, damping: 30 },
  gentle: { type: 'spring' as const, stiffness: 200, damping: 25 },
  bouncy: { type: 'spring' as const, stiffness: 400, damping: 20 },
};

// Breakpoints
export const BREAKPOINT = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

// Layout
export const LAYOUT = {
  maxWidth: '1400px',
  sidebarWidth: '340px',
  gridGap: '16px',
  cardMinWidth: '280px',
} as const;
