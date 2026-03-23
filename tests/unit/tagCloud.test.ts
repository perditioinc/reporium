/**
 * Tests for tag cloud filtering and font-size logic as rendered in StatsBar.tsx.
 * Replicates the inline logic to keep tests framework-agnostic (no React/jsdom required).
 */

import { TagMetrics } from '@/types/repo';

const SYSTEM_TAGS = new Set(['Forked', 'Fork', 'Built by Me', 'Active', 'Inactive', 'Archived', 'Popular']);

function makeMetric(tag: string, repoCount: number, activityScore = 50): TagMetrics {
  return {
    tag,
    repoCount,
    percentage: 0,
    topLanguage: null,
    languageBreakdown: {},
    updatedLast30Days: 0,
    updatedLast90Days: 0,
    olderThan90Days: 0,
    activityScore,
    relatedTags: [],
    mostRecentRepo: '',
    mostRecentDate: new Date().toISOString(),
  };
}

/** Mirrors the rendering logic in StatsBar.tsx tag cloud section */
function computeVisibleCloud(tagMetrics: TagMetrics[], limit = 30) {
  const visibleMetrics = tagMetrics
    .filter((m) => !SYSTEM_TAGS.has(m.tag))
    .sort((a, b) => b.repoCount - a.repoCount)
    .slice(0, limit);
  const maxCount = visibleMetrics[0]?.repoCount ?? 1;
  return visibleMetrics.map((m) => ({
    tag: m.tag,
    fontSize: Math.min(48, Math.max(12, 12 + (Math.log(m.repoCount + 1) / Math.log(maxCount + 1)) * 36)),
  }));
}

// ─── system tag filtering ──────────────────────────────────────────────────

describe('tag cloud — system tag filtering', () => {
  const input: TagMetrics[] = [
    makeMetric('Active', 754),
    makeMetric('Forked', 816),
    makeMetric('Fork', 10),
    makeMetric('Built by Me', 9),
    makeMetric('Inactive', 5),
    makeMetric('Archived', 20),
    makeMetric('Popular', 30),
    makeMetric('AI Agents', 201),
    makeMetric('API', 108),
    makeMetric('Claude', 176),
  ];

  it('excludes "Active" from the tag cloud', () => {
    const result = computeVisibleCloud(input);
    expect(result.map((r) => r.tag)).not.toContain('Active');
  });

  it('excludes "Forked" from the tag cloud', () => {
    const result = computeVisibleCloud(input);
    expect(result.map((r) => r.tag)).not.toContain('Forked');
  });

  it('excludes "Fork" from the tag cloud', () => {
    const result = computeVisibleCloud(input);
    expect(result.map((r) => r.tag)).not.toContain('Fork');
  });

  it('excludes "Built by Me" from the tag cloud', () => {
    const result = computeVisibleCloud(input);
    expect(result.map((r) => r.tag)).not.toContain('Built by Me');
  });

  it('excludes all 7 SYSTEM_TAGS from the tag cloud', () => {
    const result = computeVisibleCloud(input);
    const tags = result.map((r) => r.tag);
    for (const sys of SYSTEM_TAGS) {
      expect(tags).not.toContain(sys);
    }
  });

  it('includes normal content tags: AI Agents, API, Claude', () => {
    const result = computeVisibleCloud(input);
    const tags = result.map((r) => r.tag);
    expect(tags).toContain('AI Agents');
    expect(tags).toContain('API');
    expect(tags).toContain('Claude');
  });
});

// ─── font size clamping ────────────────────────────────────────────────────

describe('tag cloud — font size clamping', () => {
  it('clamps font size to minimum 12px', () => {
    const input = [makeMetric('AI Agents', 1000), makeMetric('RareTag', 1)];
    const result = computeVisibleCloud(input);
    for (const item of result) {
      expect(item.fontSize).toBeGreaterThanOrEqual(12);
    }
  });

  it('clamps font size to maximum 48px', () => {
    const input = [makeMetric('AI Agents', 1000000), makeMetric('Other', 1000)];
    const result = computeVisibleCloud(input);
    for (const item of result) {
      expect(item.fontSize).toBeLessThanOrEqual(48);
    }
  });

  it('the highest-count tag renders at 48px', () => {
    const input = [makeMetric('TopTag', 500), makeMetric('SmallTag', 1)];
    const result = computeVisibleCloud(input);
    const top = result.find((r) => r.tag === 'TopTag')!;
    expect(top.fontSize).toBe(48);
  });

  it('font sizes are proportionally larger for higher counts', () => {
    const input = [makeMetric('Big', 500), makeMetric('Medium', 50), makeMetric('Small', 5)];
    const result = computeVisibleCloud(input);
    const big = result.find((r) => r.tag === 'Big')!.fontSize;
    const medium = result.find((r) => r.tag === 'Medium')!.fontSize;
    const small = result.find((r) => r.tag === 'Small')!.fontSize;
    expect(big).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(small);
  });
});

// ─── sort order + maxCount ─────────────────────────────────────────────────

describe('tag cloud — sorted by repoCount, maxCount from top tag', () => {
  it('returns tags sorted by repoCount descending', () => {
    const input = [
      makeMetric('Zebra', 10),
      makeMetric('Apple', 200),
      makeMetric('Mango', 50),
    ];
    const result = computeVisibleCloud(input);
    const counts = result.map((r) => {
      const m = input.find((i) => i.tag === r.tag)!;
      return m.repoCount;
    });
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('alphabetically-first tag does not incorrectly set maxCount', () => {
    // "Alpha" has repoCount=5 (low), "Zebra" has repoCount=500 (high)
    // With sort, maxCount = 500, so Zebra = 48px and Alpha != 48px
    // Without sort, maxCount = 5, so both would get clamped to 48px
    const input = [makeMetric('Alpha', 5), makeMetric('Zebra', 500)];
    const result = computeVisibleCloud(input);
    const alpha = result.find((r) => r.tag === 'Alpha')!.fontSize;
    const zebra = result.find((r) => r.tag === 'Zebra')!.fontSize;
    expect(zebra).toBe(48);
    expect(alpha).toBeLessThan(48);
  });
});
