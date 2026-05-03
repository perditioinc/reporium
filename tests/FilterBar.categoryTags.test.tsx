/** @jest-environment jsdom */

/**
 * KAN-201: Verify FilterBar's per-category tag row uses the derived
 * `categoryTagsMap` prop (replacement for the trimmed `Category.tags` field
 * that previously came from /library/aggregates).
 *
 * Asserts:
 *   - When a category is selected, only tags belonging to that category
 *     (per the categoryTagsMap) are surfaced in the tag row.
 *   - When no category is selected, all tags are shown.
 *   - Selecting a different category swaps the visible tags accordingly.
 *
 * Mirrors the derivation pattern in MetricsSidebar.CategoryDetailView and
 * matches how HomePageClient builds the map from per-repo enrichedTags.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from '@/components/FilterBar';
import type { Category } from '@/types/repo';

const categories: Category[] = [
  {
    id: 'rag',
    name: 'RAG Pipelines',
    description: 'rag stuff',
    repoCount: 2,
    color: '#000',
    icon: '📚',
  },
  {
    id: 'agents',
    name: 'Agent Frameworks',
    description: 'agent stuff',
    repoCount: 1,
    color: '#111',
    icon: '🤖',
  },
  {
    id: 'mlops',
    name: 'MLOps',
    description: 'ops stuff',
    repoCount: 1,
    color: '#222',
    icon: '⚙️',
  },
];

const allTags = ['rag-pipeline', 'vector-search', 'agent', 'tool-use', 'mlflow'];

const categoryTagsMap = new Map<string, Set<string>>([
  ['RAG Pipelines', new Set(['rag-pipeline', 'vector-search'])],
  ['Agent Frameworks', new Set(['agent', 'tool-use'])],
  ['MLOps', new Set(['mlflow'])],
]);

const tagMetricsFixture = allTags.map((tag, i) => ({
  tag,
  repoCount: allTags.length - i,
  percentage: 0,
  topLanguage: null,
  languageBreakdown: {},
  updatedLast30Days: 0,
  updatedLast90Days: 0,
  olderThan90Days: 0,
  activityScore: 0,
  relatedTags: [],
  mostRecentRepo: '',
  mostRecentDate: '',
  repos: [],
  avgUpstreamAge: 0,
  avgTimeSinceForked: 0,
  mostOutdatedRepo: '',
  avgBehindBy: 0,
}));

function renderFilterBar(selectedCategory: string) {
  return render(
    <FilterBar
      categories={categories}
      categoryTagsMap={categoryTagsMap}
      languages={[]}
      allTags={allTags}
      tagMetrics={tagMetricsFixture}
      selectedCategory={selectedCategory}
      selectedType="all"
      selectedLanguage=""
      selectedLicense=""
      selectedTags={[]}
      selectedActivity="all"
      selectedSyncStatus="all"
      sortBy="updated"
      filteredCount={0}
      onCategoryChange={() => {}}
      onTypeChange={() => {}}
      onLanguageChange={() => {}}
      onLicenseChange={() => {}}
      onTagToggle={() => {}}
      onTagRemove={() => {}}
      onActivityChange={() => {}}
      onSyncStatusChange={() => {}}
      onSortChange={() => {}}
      onClear={() => {}}
    />
  );
}

describe('FilterBar — KAN-201 categoryTagsMap derivation', () => {
  it('shows only tags belonging to the selected category', () => {
    renderFilterBar('rag');
    // Tags within RAG Pipelines should appear
    expect(screen.getAllByText('rag-pipeline').length).toBeGreaterThan(0);
    expect(screen.getAllByText('vector-search').length).toBeGreaterThan(0);
    // Tags from a different category should NOT appear in the in-category tag row
    expect(screen.queryByText('mlflow')).toBeNull();
    expect(screen.queryByText('tool-use')).toBeNull();
  });

  it('swaps visible tags when a different category is selected', () => {
    const { rerender } = renderFilterBar('agents');
    expect(screen.getAllByText('agent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('tool-use').length).toBeGreaterThan(0);
    expect(screen.queryByText('rag-pipeline')).toBeNull();

    rerender(
      <FilterBar
        categories={categories}
        categoryTagsMap={categoryTagsMap}
        languages={[]}
        allTags={allTags}
        tagMetrics={tagMetricsFixture}
        selectedCategory="mlops"
        selectedType="all"
        selectedLanguage=""
        selectedLicense=""
        selectedTags={[]}
        selectedActivity="all"
        selectedSyncStatus="all"
        sortBy="updated"
        filteredCount={0}
        onCategoryChange={() => {}}
        onTypeChange={() => {}}
        onLanguageChange={() => {}}
        onLicenseChange={() => {}}
        onTagToggle={() => {}}
        onTagRemove={() => {}}
        onActivityChange={() => {}}
        onSyncStatusChange={() => {}}
        onSortChange={() => {}}
        onClear={() => {}}
      />
    );

    expect(screen.getAllByText('mlflow').length).toBeGreaterThan(0);
    expect(screen.queryByText('agent')).toBeNull();
    expect(screen.queryByText('rag-pipeline')).toBeNull();
  });

  it('shows all tags when no category is selected', () => {
    renderFilterBar('');
    // With no category selected, the broad tag list should include tags from
    // every category — none are filtered out.
    expect(screen.getAllByText('rag-pipeline').length).toBeGreaterThan(0);
    expect(screen.getAllByText('agent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('mlflow').length).toBeGreaterThan(0);
  });

  it('falls back to all tags when categoryTagsMap is missing', () => {
    // Defensive: if the parent forgets to pass the map, the UI must not be
    // empty — it should behave the same as having no category selected.
    render(
      <FilterBar
        categories={categories}
        languages={[]}
        allTags={allTags}
        tagMetrics={tagMetricsFixture}
        selectedCategory="rag"
        selectedType="all"
        selectedLanguage=""
        selectedLicense=""
        selectedTags={[]}
        selectedActivity="all"
        selectedSyncStatus="all"
        sortBy="updated"
        filteredCount={0}
        onCategoryChange={() => {}}
        onTypeChange={() => {}}
        onLanguageChange={() => {}}
        onTagToggle={() => {}}
        onTagRemove={() => {}}
        onActivityChange={() => {}}
        onSyncStatusChange={() => {}}
        onSortChange={() => {}}
        onClear={() => {}}
      />
    );
    expect(screen.getAllByText('rag-pipeline').length).toBeGreaterThan(0);
    expect(screen.getAllByText('mlflow').length).toBeGreaterThan(0);
  });
});

// silence the unused fireEvent import lint warning if it isn't otherwise referenced
void fireEvent;
