# Reporium Style Guide

## Design Principles

1. **Dark-first** -- every surface, color, and contrast ratio is designed for dark mode. Light mode is not a target.
2. **Progressive disclosure** -- show the minimum viable data by default; reveal detail on hover, click, or expand.
3. **Reveal on interaction** -- secondary actions, metadata, and controls appear only when the user signals intent (hover, focus, selection).
4. **Subtle motion** -- animation reinforces spatial relationships and state changes without drawing attention to itself. Max 300 ms for micro-interactions.

## Token Reference

All design tokens live in `src/styles/tokens.ts` (TypeScript constants) and `src/styles/tokens.css` (CSS custom properties). Components should consume CSS custom properties wherever possible; use the TS constants for JS/Framer Motion values.

### Spacing

| Token | Value |
|-------|-------|
| xs    | 4 px  |
| sm    | 8 px  |
| md    | 16 px |
| lg    | 24 px |
| xl    | 32 px |
| 2xl   | 48 px |
| 3xl   | 64 px |

### Typography

- **Sans**: Inter, system-ui, sans-serif
- **Mono**: JetBrains Mono, monospace
- Base size: 0.875 rem (14 px)
- Weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

### Color Palette

| Role               | Token                    | Value        |
|---------------------|--------------------------|-------------|
| Background void     | `--color-bg-void`        | `#0a0a0f`   |
| Background base     | `--color-bg-base`        | `#09090b`   |
| Background raised   | `--color-bg-raised`      | `#18181b`   |
| Background overlay  | `--color-bg-overlay`     | `#27272a`   |
| Border subtle       | `--color-border-subtle`  | `#27272a`   |
| Border default      | `--color-border-default` | `#3f3f46`   |
| Text primary        | `--color-text-primary`   | `#f4f4f5`   |
| Text secondary      | `--color-text-secondary` | `#a1a1aa`   |
| Text muted          | `--color-text-muted`     | `#71717a`   |
| Accent              | `--color-accent`         | `#8b5cf6`   |
| Success             | `--color-success`        | `#22c55e`   |
| Warning             | `--color-warning`        | `#f59e0b`   |
| Danger              | `--color-danger`         | `#ef4444`   |

## Component Variants

### Card

| Variant        | Class               | Behavior |
|----------------|---------------------|----------|
| Minimal        | `.card`             | Raised background, subtle border, default state |
| Hover          | `.card .card-hover`  | Border brightens, background shifts on hover |
| Selected       | `.card-selected`     | Accent border glow, tinted background |

### Buttons

| Variant    | Class           | Use case |
|------------|-----------------|----------|
| Primary    | `.btn .btn-primary` | Primary CTA -- submit, confirm |
| Secondary  | `.btn .btn-secondary` | Secondary actions -- cancel, back |
| Ghost      | `.btn .btn-ghost`   | Tertiary / inline actions |
| Sizes      | `.btn-sm`, `.btn-md` | Small (12 px font) or medium (14 px font) |

### Panel

Floating container with backdrop blur, used for modals, popovers, command palette.

- `.panel` -- outer container
- `.panel-header` -- top bar with bottom border
- `.panel-body` -- content area

### Badge

Inline status or category indicator.

- `.badge .badge-default` -- neutral (muted text on overlay bg)
- `.badge .badge-accent` -- accent-tinted

## Mode Rules

### Explore Mode (browse-first)

- Cards show: name, primary metric, category badge
- Secondary metadata hidden until hover
- Actions hidden until hover or selection
- Grid layout with auto-fill columns

### Detail Mode (full data)

- All metadata visible immediately
- Actions always visible
- Sidebar or full-width layout
- Related items and graph connections shown

## Responsive Breakpoints

| Breakpoint | Min width | Behavior |
|------------|-----------|----------|
| sm         | 640 px    | Single column, stacked cards |
| md         | 768 px    | Two-column grid, sidebar collapses |
| lg         | 1024 px   | Full grid + sidebar |
| xl         | 1280 px   | Max-width container, wider cards |

Mobile-first: default styles target smallest screens, layers added via min-width media queries.

## Motion

### Framer Motion Spring Presets

| Preset  | Stiffness | Damping | Use case |
|---------|-----------|---------|----------|
| snappy  | 300       | 30      | Toggles, tabs, quick state changes |
| gentle  | 200       | 25      | Page transitions, panel open/close |
| bouncy  | 400       | 20      | Attention-drawing, celebratory feedback |

### Rules

- Micro-interactions (hover, focus, toggle): max 150 ms CSS transition
- Layout shifts (expand, collapse): max 300 ms spring animation
- Page transitions: 200-300 ms with gentle spring
- Respect `prefers-reduced-motion`: disable springs, use instant transitions

## Accessibility

- **Focus visible**: all interactive elements show a 2 px accent-colored outline on `:focus-visible` (not on click)
- **Contrast**: all text/background combinations meet WCAG AA (4.5:1 for normal text, 3:1 for large text)
  - Primary text (#f4f4f5) on base (#09090b): 18.1:1
  - Secondary text (#a1a1aa) on base: 7.5:1
  - Muted text (#71717a) on base: 4.6:1
- **Touch targets**: minimum 44x44 px for mobile
- **Screen readers**: use semantic HTML, aria-labels on icon-only buttons, live regions for dynamic content
