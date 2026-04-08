# Changelog

## [Unreleased]

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
