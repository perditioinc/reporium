# Lighthouse Baseline Audit: reporium.com

**Date:** 2026-04-19  
**Tool:** Lighthouse 12.8.2  
**Measured:** Home page only (repo detail pages and category pages return 404)

---

## Summary Scores

| Route | Performance | Accessibility | SEO | Best Practices |
|-------|-------------|----------------|-----|----------------|
| / (home) | 11 | 88 | 100 | 96 |

---

## Core Web Vitals

| Metric | Value | Assessment |
|--------|-------|------------|
| **LCP** (Largest Contentful Paint) | 10,252 ms | ⚠️ POOR (target: <2,500ms) |
| **FCP** (First Contentful Paint) | 1,922 ms | ⚠️ NEEDS IMPROVEMENT |
| **CLS** (Cumulative Layout Shift) | 0.673 | ⚠️ POOR (target: <0.1) |
| **TBT** (Total Blocking Time) | 9,513 ms | 🔴 CRITICAL (target: <300ms) |
| **TTI** (Time to Interactive) | 22,309 ms | 🔴 CRITICAL (target: <3,800ms) |
| **SI** (Speed Index) | 11,025 ms | 🔴 CRITICAL (target: <3,750ms) |

---

## Performance Issues (21 Failed Audits)

### Top 5 Biggest Opportunities

1. **Largest Contentful Paint** - Main performance bottleneck
   - Current: 10,252ms vs target <2,500ms
   - Root: Large unoptimized images or slow resource delivery likely delaying main content render

2. **Total Blocking Time** - JavaScript execution is blocking user interaction
   - Current: 9,513ms vs target <300ms
   - Root: Heavy JavaScript execution during page load preventing user input

3. **Layout Shift Culprits** - CLS score of 0.673 indicates significant layout instability
   - Potential visual regression during load
   - Root: Missing size attributes on images/content, CSS animations, or ads causing reflow

4. **Forced Reflow** - Inefficient DOM manipulation
   - Potential savings: Batch DOM updates to reduce reflows

5. **Network Dependency Tree** - Resource waterfall chains are too long
   - Potential savings: Use resource hints (preconnect, prefetch) or reduce critical path length

---

## Accessibility Issues (3 Failed Audits)

1. **Buttons do not have an accessible name**
   - Impact: Screen reader users cannot identify button purpose
   - Fix: Add aria-label or ensure visible text on all buttons

2. **Background and foreground colors do not have sufficient contrast**
   - Impact: Low-vision users may not be able to read text
   - Fix: Audit color pairs and increase contrast ratios to WCAG AA minimum

3. **Heading elements are not in a sequentially-descending order**
   - Impact: Assistive technology navigation is broken
   - Fix: Ensure h1 → h2 → h3 hierarchy (no skips)

---

## Best Practices Issues (2 Failed Audits)

1. **Browser errors were logged to the console**
   - Issue: JavaScript errors are occurring on load
   - Impact: May indicate broken functionality or performance issues

2. **Missing source maps for large first-party JavaScript**
   - Issue: Cannot debug production errors
   - Recommendation: Include source maps in production builds for error monitoring

---

## SEO

✅ **All checks pass (100/100)**  
- Meta tags, structured data, mobile-friendliness all configured correctly

---

## THE BIGGEST OPPORTUNITY

**Eliminate Total Blocking Time (TBT: 9,513ms → <300ms)**

The home page has 9.5 seconds of JavaScript blocking user interaction. This is the single largest performance problem and directly impacts:
- Time to Interactive (currently 22.3s)
- Speed Index (currently 11.0s)
- User perception of page responsiveness

**Quick wins:**
1. Code-split JavaScript—defer non-critical bundles
2. Remove or defer heavy third-party scripts (analytics, ads, etc.)
3. Optimize initial JavaScript bundle size (consider Reduce Unused JavaScript: ~160ms potential savings)

---

## Measurement Notes

- **Chrome headless** browser used (no extensions, consistent environment)
- **Network:** Default Lighthouse throttling (4G+)
- **Device:** Simulated desktop
- **Repo/Category pages:** Not measured (returning 404—may not exist or may be behind auth)

### Next Steps

1. Investigate JavaScript bundle size and execution (check webpack/Vite bundle analysis)
2. Profile runtime JavaScript with Chrome DevTools to identify blocking operations
3. Measure impact of code-splitting and lazy-loading strategies
4. Fix accessibility issues (contrast, heading hierarchy, button labels)
5. Re-baseline after optimizations
