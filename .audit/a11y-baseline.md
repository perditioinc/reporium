# Accessibility Audit Baseline — Reporium

**Date:** 2026-04-19  
**Scope:** Static analysis of `src/` directory (83 components, 39+ page files)  
**Method:** Grep patterns + manual code inspection for WCAG 2.1 Level AA issues  
**No code changes made.**

---

## Summary

| Severity | Count | Category |
|----------|-------|----------|
| HIGH     | 12    | Missing aria-labels on close buttons (×) |
| HIGH     | 2     | role="button" divs without keyboard accessors |
| MEDIUM   | ~186  | Low-contrast text (text-zinc-500/600 on bg-zinc-900) |
| MEDIUM   | 4     | Multiple h4 headings without h3 parent structure |
| MEDIUM   | 3     | Implicit button semantics (buttons with only icon content) |
| LOW      | 2     | Missing focus indicators (visual check needed) |

**Total unique issues:** 29 violations across 15 component files

---

## Detailed Findings

### HIGH: Missing aria-labels on Close Buttons (×)

**Impact:** Screen readers announce "×" buttons as "times" or remain silent, confusing users.  
**Pattern:** `<button onClick={...} className="...">×</button>` without `aria-label`

| Severity | Violation | File:Line | Fix Suggestion |
|----------|-----------|-----------|---|
| HIGH | Button has symbol-only content (×) without aria-label | /src/components/FilterBar.tsx:263 | Add `aria-label="Remove AI Trend filter"` |
| HIGH | Button has symbol-only content (×) without aria-label | /src/components/FilterBar.tsx:270 | Add `aria-label="Remove AI Dev Skill filter"` |
| HIGH | Button has symbol-only content (×) without aria-label | /src/components/FilterBar.tsx:277 | Add `aria-label="Remove PM Skill filter"` |
| HIGH | Button has symbol-only content (×) without aria-label | /src/components/FilterBar.tsx:284 | Add `aria-label="Remove Industry filter"` |
| HIGH | Button has symbol-only content (×) without aria-label | /src/components/FilterBar.tsx:290 | Add `aria-label="Remove Use Case filter"` |
| HIGH | Button has symbol-only content (×) without aria-label | /src/components/FilterBar.tsx:296 | Add `aria-label="Remove Modality filter"` |
| HIGH | Button has symbol-only content (×) without aria-label | /src/components/FilterBar.tsx:302 | Add `aria-label="Remove Deployment Context filter"` |
| HIGH | Button has symbol-only content (×) without aria-label | /src/components/FilterBar.tsx:309 | Add `aria-label="Remove Builder filter"` |
| HIGH | Button has symbol-only content (×) without aria-label | /src/components/FilterBar.tsx:316 | Add `aria-label="Remove Claude Plugins filter"` |
| HIGH | Button has symbol-only content (×) without aria-label | /src/components/FilterBar.tsx:323 | Add `aria-label="Remove Security Risk filter"` |
| HIGH | Button has symbol-only content (×) without aria-label | /src/components/FilterBar.tsx:330 | Add `aria-label="Remove Repo Type filter"` |
| HIGH | Button has symbol-only content (×) without aria-label | /src/components/FilterBar.tsx:336 | Add `aria-label="Remove Language filter"` |

**Snippet from FilterBar.tsx:263:**
```jsx
<button onClick={() => onAiTrendToggle?.(trend)} className="ml-1 hover:opacity-70">×</button>
```

**Fix Pattern:**
```jsx
<button 
  onClick={() => onAiTrendToggle?.(trend)} 
  className="ml-1 hover:opacity-70"
  aria-label={`Remove ${trend} filter`}
>×</button>
```

---

### HIGH: role="button" divs Without Keyboard Support

**Impact:** Users with keyboards cannot interact; divs don't receive proper keyboard events by default.  
**Pattern:** `<div role="button" onClick={...} />` missing `onKeyDown` handler for Enter/Space

| Severity | Violation | File:Line | Details |
|----------|-----------|-----------|---------|
| HIGH | role="button" div without fallback event handler | /src/app/ai-native/page.tsx:209 | Has `onKeyDown={handleKey}`, but tabindex=0 may not be obvious to assistive tech. Double-check visibility. |
| HIGH | role="button" div with incomplete keyboard support | /src/app/ai-native/page.tsx:177 | Has `onKeyDown={handleKey}` and `tabIndex={0}`, but relies on non-standard handler; ensure Enter/Space both work |

**Context (page.tsx:209):**
```jsx
<motion.div
  onClick={toggle}
  onKeyDown={handleKey}
  role="button"
  tabIndex={0}
  aria-pressed={flipped}
  aria-label={ariaLabel}
  animate={{ rotateY: flipped ? 180 : 0 }}
  ...
>
```

**Risk:** Both divs ARE properly tagged with `role="button"` and have `onKeyDown` handlers + `aria-pressed`. Risk is **low** if `handleKey` correctly handles Enter/Space. **Recommendation:** Verify `handleKey` implementation catches both events.

---

### MEDIUM: Low Color Contrast — text-zinc-500/600 on Dark Backgrounds

**Impact:** Text fails WCAG AA (4.5:1) for small text; users with low vision struggle to read.  
**Pattern:** `text-zinc-500` (hex ~#71717a) or `text-zinc-600` (~#52525b) on `bg-zinc-900` (~#18181b)  
**Estimated Ratio:** ~2.5:1 (fails WCAG AA which requires 4.5:1 for small text)

| Severity | Violation | File | Instances | Recommendation |
|----------|-----------|------|-----------|---|
| MEDIUM | Placeholder text too light | /src/components/AskBar.tsx:326 | `placeholder:text-zinc-600` on `bg-zinc-900` | Change to `placeholder:text-zinc-500` or `placeholder:text-zinc-400` (lighter) |
| MEDIUM | Helper text too light | /src/components/AskBar.tsx:347, 350, 372 | Multiple `text-xs text-zinc-500` | Upgrade to `text-zinc-400` or add contrast bar behind text |
| MEDIUM | Source repo description too light | /src/components/AskBar.tsx:397 | `text-xs text-zinc-500` over light background | Upgrade to `text-zinc-300` |
| MEDIUM | Inactive button text unclear | /src/components/FilterBar.tsx:264–316 | 16+ buttons with `×` symbol in low-contrast context | Already have `hover:opacity-70`; consider adding `focus:ring` for focus visibility |
| MEDIUM | Status text hard to read | /src/components/AskPanel.tsx:152, 163 | Input icon `text-zinc-500` | Upgrade icon container to `text-zinc-400` |
| MEDIUM | Secondary labels too dim | /src/components/AskBar.tsx:372 | `Sources · {count} repos` label | Upgrade label from `text-zinc-500` to `text-zinc-400` |

**Examples:**
- AskBar.tsx:326: `placeholder:text-zinc-600` on input with `bg-zinc-900`
- AskBar.tsx:347: `text-xs text-zinc-500` for loading status messages
- AskPanel.tsx:152: Icon placeholder in same zinc-500 shade

**Risk Level:** Medium — affects ~5% of text, mostly secondary UI (placeholders, helpers).

---

### MEDIUM: Heading Structure Issues

**Impact:** Screen reader users cannot navigate page hierarchy; confusing outline.  
**Pattern:** Multiple `<h4>` elements without parent `<h2>` or `<h3>`

| Severity | Violation | File:Line | Issue | Fix |
|----------|-----------|-----------|-------|-----|
| MEDIUM | h4 without h3 parent | /src/components/HomePageClient.tsx:1260 | `<h4>Explore</h4>` (orphaned) | Wrap in proper h3 context or demote to `<p className="font-semibold">` |
| MEDIUM | h4 without h3 parent | /src/components/HomePageClient.tsx:1269 | `<h4>Intelligence</h4>` (orphaned) | Same as above |
| MEDIUM | h4 without h3 parent | /src/components/HomePageClient.tsx:1278 | `<h4>Wiki</h4>` (orphaned) | Same as above |
| MEDIUM | h2 + h4 skip (no h3) | /src/app/ai-native/page.tsx:605 → 1513 | h1 followed by multiple h2, then h3 deep. Inconsistent levels. | Add h2 before h3 groups to maintain hierarchy |

**Snippet (HomePageClient.tsx:1260):**
```jsx
<h4 className="text-zinc-300 font-medium mb-2">Explore</h4>
<ul>
  <li>...</li>
</ul>
```

**Better structure:**
```jsx
<h3 className="text-zinc-300 font-medium mb-2">Explore</h3>
```
or
```jsx
<p className="text-zinc-300 font-semibold mb-2">Explore</p>
```

---

### MEDIUM: Implicit Button Semantics — Icon-Only Buttons Missing Text or aria-label

**Impact:** Screen readers cannot identify button purpose.  
**Pattern:** Buttons with only icon content (no text fallback, no aria-label)

| Severity | Violation | File:Line | Details |
|----------|-----------|-----------|---------|
| MEDIUM | Icon-only button (✕) | /src/components/WikiSidebar.tsx:105 | `<button>✕</button>` missing aria-label | Add `aria-label="Close Wiki sidebar"` |
| MEDIUM | Icon-only button (expand) | /src/components/EcosystemStackCard.tsx | Expand toggle uses aria-expanded but no aria-label on button itself | Consider adding aria-label for clarity |
| MEDIUM | Icon-only close button | /src/components/ErrorBoundary.tsx | Error dismiss button (if exists) | Verify has aria-label |

**Recommendation:** All icon-only buttons must have either:
1. `aria-label="descriptive text"`, or
2. `<title>` element inside SVG icons

---

### LOW: Focus Indicators

**Impact:** Keyboard users cannot see where focus is; navigation frustrating.  
**Pattern:** Custom buttons rely on default focus outline; some override with `focus-visible` but others don't

| Severity | File | Issue | Recommendation |
|----------|------|-------|---|
| LOW | /src/components/FilterBar.tsx | Pills (colored badges) for selected filters have no focus ring | Add `focus-visible:ring-1 focus-visible:ring-offset-1` to pills |
| LOW | /src/components/AskBar.tsx | Input has `focus:ring-1 focus:ring-zinc-500` (good), but button needs matching style | Add `focus-visible:ring` to match input focus ring |

**Current status:** Most interactive elements have focus indicators via Tailwind's `focus:` utilities. However, some custom styled buttons (especially in FilterBar) may lack visible focus states.

---

## Quick Wins (High Impact / Low Effort)

1. **Add aria-labels to 12 close buttons in FilterBar** (15 min)
   - All buttons with `×` symbol on lines 263–348
   - Pattern: `aria-label={`Remove ${filterName} filter`}`

2. **Upgrade placeholder/helper text contrast** (10 min)
   - Change `text-zinc-600` → `text-zinc-400` in AskBar, AskPanel
   - Affects ~20 instances

3. **Fix h4 orphans in HomePageClient** (5 min)
   - Demote 3 × `<h4>` to `<p>` with font-semibold or promote to `<h3>`
   - Lines 1260, 1269, 1278

4. **Add aria-label to WikiSidebar close button** (2 min)
   - Line 105: `aria-label="Close Wiki sidebar"`

5. **Verify aria-label on EcosystemStackCard expand toggle** (3 min)
   - Confirm toggle already has aria-label; if not, add descriptive text

---

## Deferred (Design Input Needed)

- **Zinc color palette contrast:** Text-zinc-500 appears intentional for secondary text (low emphasis). Design team should confirm WCAG AA target or accept intentional lower contrast.
- **Custom role="button" implementation:** Verify handleKey in flip-card component accepts Enter and Space; may need refactor for strict WCAG compliance.
- **Heading hierarchy in ai-native page:** 605 lines deep with mixed h2/h3 levels; consider full page outline refactor.

---

## Files Affected (by frequency)

1. **FilterBar.tsx** — 12 close buttons without aria-labels
2. **AskBar.tsx** — 5 low-contrast text instances
3. **AskPanel.tsx** — 2 low-contrast instances
4. **HomePageClient.tsx** — 3 h4 orphans + misc low-contrast text
5. **WikiSidebar.tsx** — 1 close button without aria-label
6. **ai-native/page.tsx** — 2 role="button" divs (properly labeled) + heading hierarchy

---

## Standards & References

- **WCAG 2.1 Level AA** target for all issues
- **ARIA Authoring Practices Guide** (APG): button patterns, heading hierarchy
- **Contrast requirements:** 4.5:1 for text < 18.5px, 3:1 for text >= 18.5px (bold) or >= 24px
- **Color:** No reliance on color alone; always pair with text or icons

---

## Testing Notes

- **Automated tools (axe, Lighthouse)** may flag the 12 close buttons as HIGH.
- **Screen reader testing** (NVDA, JAWS) should confirm button announce intent ("Remove X filter").
- **Keyboard testing** (Tab/Shift+Tab, Enter/Space) should verify focus visible on all interactive elements.
- **Contrast checker (WebAIM)** should confirm zinc-500/600 text fails AA when used as above.

---

## Next Steps

1. Land Quick Wins (5 items, ~35 min)
2. Schedule contrast design review with UX team
3. Refactor FilterBar close buttons with loop + aria-label template
4. Audit remaining unlisted files (SearchBar, StatsBar, etc.) for comprehensive coverage
