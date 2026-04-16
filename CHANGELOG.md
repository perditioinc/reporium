# Changelog

## [Unreleased]

### Fixed
- **Site-wide keyboard scrolling** — new `GlobalKeyboardScroll` component makes ArrowUp/ArrowDown/PageUp/PageDown/Home/End/Space scroll the primary `.overflow-y-auto` container on every route. Pages using the `flex h-screen overflow-hidden` chrome (home, wiki, graph, etc.) previously had no keyboard scrolling because `window` has no scroll range — arrow keys fired against it and did nothing. Handler opts out on `/ai-native` so that page's own slide-nav handler remains authoritative. Inputs, textareas, contenteditable, and `role="dialog"`/`role="menu"` descendants are excluded to preserve form/modal behavior.
- **Home-page flicker on return navigation** — removed `setData(null)` from `HomePageClient` load effect; the `provider` caches library data at module scope, so a repeat mount (user navigates back to `/` from another page) resolves synchronously from cache instead of briefly blanking the UI.

### Added
- **Loading cursor bubbles** — new `LoadingCursorBubbles` component emits small purple bubble particles at the cursor position while a Next.js route transition is in flight. Complements the existing top-of-page `RouteProgress` bar: people look at their cursor, not the top of the viewport, so loading now registers in peripheral vision. Bubble-emission is tied to the same internal-link click heuristic as `RouteProgress`; each bubble floats up and fades over 900ms via CSS animation. `pointer-events-none` / `aria-hidden` so it can't intercept clicks or pollute the a11y tree.

### Changed
- **/ai-native: framework-first rewrite** — stripped presentation logistics and Workato-centric framing; removed hardcoded stats (1,641 repos, $5.28 spend, 10 days to ship); replaced Live Demo slide with "What Makes Reporium AI-Native" architecture slide; expanded AI-Native Test from 3 to 4 questions to map 1:1 to the 4 AI-native layers; LLM references now model-agnostic (Claude/GPT/local); replaced CEO byline with neutral "A framework from building Reporium".

### Added
- **Architecture diagram on /ai-native** — inline SVG mapping 4 AI-native layers (Agent-accessible, Intelligence, Semantic, Compounding) and 3 cross-cutting bands (Observability, Governance, Performance) to real Reporium services from the verified reporium-api README. Responsive (1440/1024/768), accessible (aria-labels, role=img).

### Removed
- **/ai-native: Q&A close** — replaced with one-takeaway close.
- **/ai-native: Live Demo slide** — no more Workato-centric demo script embedded in the public page.

### Added
- **Knowledge Graph: Typed edge geometry** — Each relationship type now has a visually distinct style:
  - `SIMILAR_TO`: thin straight lines (unchanged baseline, best performance)
  - `COMPATIBLE_WITH`: quadratic bezier arcs bowing outward 15% of edge length
  - `ALTERNATIVE_TO`: dashed segments (3 drawn sections per edge)
  - `DEPENDS_ON`: straight line + `InstancedMesh` cone arrowhead at target node
  - `EXTENDS`: two parallel lines offset ±2 units perpendicular to edge direction
- **Knowledge Graph: Invisible click spheres** — Each node has a 2.5× radius transparent sphere for hit detection, making nodes far easier to select
- **Repo Cards: Glassmorphism** — Strengthened to `blur(24px) saturate(180%)`, border opacity 0.12, stronger box-shadow with inset highlights, inner radial glow for bubble feel
- **Repo Cards: Category top border** — 3px solid top accent border in category color
- **Repo Cards: Category background tint** — ~5% opacity category-color background blending with glass base
- **Repo Cards: Category color dot** — Colored dot next to the repo name in the card header
- **Filter Bar: Color-coded category pills** — `CategoryFilterBar` and `FilterBar` categories tab use each category's color for active/inactive/hover states
- **Page background gradient** — Subtle radial gradient on body so `backdrop-filter` blur has texture to refract, making the glass effect visible

### Fixed
- **RepoCardMinimal glassmorphism** — Home-page cards use `RepoCardMinimal` (inline styles), not `RepoCard`; applied same glass treatment: `blur(20px) saturate(160%)`, category-color 3px top border, translucent background, and colored dot next to repo name
- **ESLint: unused imports** — Removed `CATEGORY_COLORS` and `CATEGORY_LABELS` from `KnowledgeGraph3D.tsx` imports (no longer needed after typed-edge refactor)
