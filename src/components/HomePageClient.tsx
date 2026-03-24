'use client';

import { useState, useEffect, useMemo } from 'react';
import { LibraryData, EnrichedRepo, SortOption } from '@/types/repo';
import type { TrendData } from '@/types/repo';
import { StatsBar } from '@/components/StatsBar';
import { SearchBar } from '@/components/SearchBar';
import { FilterBar } from '@/components/FilterBar';
import { RepoGrid } from '@/components/RepoGrid';
import { LoadingState } from '@/components/LoadingState';
import { LoadingBanner } from '@/components/LoadingBanner';
import { MetricsSidebar } from '@/components/MetricsSidebar';
import { MiniAskBar } from '@/components/MiniAskBar';
import { PortfolioInsightsWidget } from '@/components/PortfolioInsightsWidget';
import { CrossDimensionWidget } from '@/components/CrossDimensionWidget';
import { TrendingThisWeekWidget } from '@/components/TrendingThisWeekWidget';
import { buildIntersectionMetrics } from '@/lib/buildTagMetrics';
import { createDataProvider, SearchMode } from '@/lib/dataProvider';



const provider = createDataProvider();

/** Main library page */
export function HomePageClient() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [portfolioInsights, setPortfolioInsights] = useState<Awaited<ReturnType<typeof provider.getPortfolioInsights>>>(null);
  const [crossDimensionAnalytics, setCrossDimensionAnalytics] = useState<Awaited<ReturnType<typeof provider.getCrossDimensionAnalytics>>>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
  const [semanticResults, setSemanticResults] = useState<EnrichedRepo[] | null>(null);
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | 'built' | 'forked'>('all');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedLicense, setSelectedLicense] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedSyncStatus, setSelectedSyncStatus] = useState<'all' | 'up-to-date' | 'behind' | 'behind-100' | 'ahead' | 'diverged'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [attentionFilter, setAttentionFilter] = useState<'all' | 'archived-parent' | 'stale'>('all');
  const [showOutdatedOnly, setShowOutdatedOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  // New taxonomy filter state
  const [selectedAiDevSkills, setSelectedAiDevSkills] = useState<string[]>([]);
  const [selectedPmSkills, setSelectedPmSkills] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedAiTrends, setSelectedAiTrends] = useState<string[]>([]);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
  const [selectedDeploymentContexts, setSelectedDeploymentContexts] = useState<string[]>([]);
  const [selectedBuilders, setSelectedBuilders] = useState<string[]>([]);
  const [aiTrendValues, setAiTrendValues] = useState<Awaited<ReturnType<typeof provider.getTaxonomyValues>>>([]);
  const [industryValues, setIndustryValues] = useState<Awaited<ReturnType<typeof provider.getTaxonomyValues>>>([]);
  const [useCaseValues, setUseCaseValues] = useState<Awaited<ReturnType<typeof provider.getTaxonomyValues>>>([]);
  const [modalityValues, setModalityValues] = useState<Awaited<ReturnType<typeof provider.getTaxonomyValues>>>([]);
  const [deploymentContextValues, setDeploymentContextValues] = useState<Awaited<ReturnType<typeof provider.getTaxonomyValues>>>([]);

  // Mobile sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const repoParam = params.get('repo');
      if (repoParam) {
        setSearch(repoParam);
      }
      const tagParam = params.get('tag');
      if (tagParam) {
        setSelectedTags([tagParam]);
      }
      const taxonomyDimension = params.get('taxonomyDimension');
      const taxonomyValue = params.get('taxonomyValue');
      if (taxonomyDimension && taxonomyValue) {
        if (taxonomyDimension === 'skill_area') {
          setSelectedAiDevSkills([taxonomyValue]);
        } else if (taxonomyDimension === 'industry') {
          setSelectedIndustries([taxonomyValue]);
        } else if (taxonomyDimension === 'use_case') {
          setSelectedUseCases([taxonomyValue]);
        } else if (taxonomyDimension === 'modality') {
          setSelectedModalities([taxonomyValue]);
        } else if (taxonomyDimension === 'ai_trend') {
          setSelectedAiTrends([taxonomyValue]);
        } else if (taxonomyDimension === 'deployment_context') {
          setSelectedDeploymentContexts([taxonomyValue]);
        }
      }
    }
  }, []); // run once on mount

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setData(null);

      // Stage 1: load owned repos (~5KB) — shows YOUR repos instantly
      const owned = await provider.getOwnedLibrary().catch(() => null);
      if (!cancelled && owned) {
        setData(owned);
        setIsLoading(false);
        setIsLoadingFull(true);
      }

      // Stage 2: load full library (~3MB) in background, then merge in
      try {
        const full = await provider.getLibrary();
        if (!cancelled) {
          setData(full);
          setIsLoadingFull(false);
        }
        // Non-blocking extras
        provider.getTrends()
          .then(t => { if (!cancelled && t) setTrends(t); })
          .catch(() => {});
        provider.getPortfolioInsights()
          .then(insights => { if (!cancelled) setPortfolioInsights(insights); })
          .catch(() => {});
        provider.getCrossDimensionAnalytics('industry', 'ai_trend')
          .then(analytics => { if (!cancelled) setCrossDimensionAnalytics(analytics); })
          .catch(() => {});
        provider.getGaps().catch(() => {});
      } catch (e) {
        if (!cancelled) {
          setIsLoadingFull(false);
          if (!owned) setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);  // no dependencies — loads once

  useEffect(() => {
    let cancelled = false;

    async function runSemanticSearch() {
      if (!data || searchMode !== 'semantic' || !search.trim()) {
        setSemanticResults(null);
        setIsSearchingSemantic(false);
        return;
      }

      setIsSearchingSemantic(true);
      try {
        const rawResults = await provider.searchRepos(search.trim(), 'semantic');
        if (cancelled) return;

        const repoMap = new Map(data.repos.map((repo) => [repo.name, repo]));
        const merged = rawResults.reduce<EnrichedRepo[]>((acc, result) => {
          const existing = repoMap.get(result.name);
          if (!existing) return acc;
          acc.push({
            ...existing,
            similarity: result.similarity,
          });
          return acc;
        }, []);

        setSemanticResults(merged);
      } catch {
        if (!cancelled) setSemanticResults([]);
      } finally {
        if (!cancelled) setIsSearchingSemantic(false);
      }
    }

    runSemanticSearch();
    return () => {
      cancelled = true;
    };
  }, [data, search, searchMode]);

  useEffect(() => {
    if (!data) return;

    let cancelled = false;

    async function loadTaxonomyValues() {
      try {
        const [aiTrends, industries, useCases, modalities, deploymentContexts] = await Promise.all([
          provider.getTaxonomyValues('ai_trend'),
          provider.getTaxonomyValues('industry'),
          provider.getTaxonomyValues('use_case'),
          provider.getTaxonomyValues('modality'),
          provider.getTaxonomyValues('deployment_context'),
        ]);

        if (cancelled) return;
        setAiTrendValues(aiTrends);
        setIndustryValues(industries);
        setUseCaseValues(useCases);
        setModalityValues(modalities);
        setDeploymentContextValues(deploymentContexts);
      } catch {
        if (cancelled) return;
        setAiTrendValues([]);
        setIndustryValues([]);
        setUseCaseValues([]);
        setModalityValues([]);
        setDeploymentContextValues([]);
      }
    }

    loadTaxonomyValues();
    return () => {
      cancelled = true;
    };
  }, [data]);

  const allLanguages = useMemo(() => data?.stats.languages ?? [], [data]);

  /** Map stale DB category names → current taxonomy names.
   *  Keeps the filter bar clean until the DB/API backfill corrects the source data. */
  const CATEGORY_ALIASES: Record<string, string> = {
    'Audio':       'Industry: Audio & Music',
    'Fine Tuning': 'Model Training',
    'Evaluation':  'Evals & Benchmarking',
    'Deployment':  'MLOps & Infrastructure',
  };

  /** Categories with stale names merged into their canonical equivalents. */
  const normalizedCategories = useMemo(() => {
    if (!data?.categories) return [];
    const catMap = new Map(data.categories.map(c => ({ ...c })).map(c => [c.name, c]));
    for (const [stale, canonical] of Object.entries(CATEGORY_ALIASES)) {
      const staleEntry = catMap.get(stale);
      if (!staleEntry) continue;
      catMap.delete(stale);
      const canonicalEntry = catMap.get(canonical);
      if (canonicalEntry) canonicalEntry.repoCount += staleEntry.repoCount;
    }
    return Array.from(catMap.values());
  }, [data]);

  const industryStats = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const repo of data.repos) {
      for (const ind of (repo.taxonomy ?? []).filter((entry) => entry.dimension === 'industry').map((entry) => entry.value)) {
        counts.set(ind, (counts.get(ind) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([industry, count]) => ({ industry, count }));
  }, [data]);

  const trendingThisWeek = useMemo(() => {
    if (!data) return [];
    return [...data.repos]
      .filter((repo) => (repo.commitStats?.last7Days ?? repo.weeklyCommitCount ?? 0) > 0)
      .sort((a, b) => {
        const left = b.commitStats?.last7Days ?? b.weeklyCommitCount ?? 0;
        const right = a.commitStats?.last7Days ?? a.weeklyCommitCount ?? 0;
        return left - right;
      })
      .slice(0, 5);
  }, [data]);

  const languageCounts = useMemo(() => {
    if (!data) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const repo of data.repos) {
      if (repo.language) counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
    }
    return counts;
  }, [data]);

  const licenseCounts = useMemo(() => {
    if (!data) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const repo of data.repos) {
      if (repo.licenseSpdx) counts.set(repo.licenseSpdx, (counts.get(repo.licenseSpdx) ?? 0) + 1);
    }
    return counts;
  }, [data]);

  const allTags = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const repo of data.repos) {
      for (const tag of repo.enrichedTags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [data]);

  // Intersection metrics — computed when 2+ tags selected, null otherwise
  const intersectionMetrics = useMemo(() => {
    if (!data || selectedTags.length < 2) return null;
    return buildIntersectionMetrics(selectedTags, data.repos);
  }, [data, selectedTags]);

  const filteredAndSortedRepos = useMemo<EnrichedRepo[]>(() => {
    if (!data) return [];

    const sourceRepos =
      searchMode === 'semantic' && search.trim()
        ? (semanticResults ?? [])
        : data.repos;

    const filtered = sourceRepos.filter((repo) => {
      // Text search — name and description only, never tags
      if (search && searchMode === 'keyword') {
        const q = search.toLowerCase();
        const matchesSearch =
          repo.name.toLowerCase().includes(q) ||
          (repo.description ?? '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (selectedType === 'built' && repo.isFork) return false;
      if (selectedType === 'forked' && !repo.isFork) return false;

      // Language filter
      if (selectedLanguage && repo.language !== selectedLanguage) return false;
      if (selectedLicense && repo.licenseSpdx !== selectedLicense) return false;

      // Tag filter — strictly against enrichedTags only
      if (selectedTags.length > 0) {
        const hasAllTags = selectedTags.every((tag) => repo.enrichedTags.includes(tag));
        if (!hasAllTags) return false;
      }

      // Activity filter
      if (selectedActivity === 'active' && !repo.enrichedTags.includes('Active')) return false;
      if (selectedActivity === 'inactive' && !repo.enrichedTags.includes('Inactive')) return false;

      // Attention filter
      if (attentionFilter === 'archived-parent') {
        if (!repo.parentStats?.isArchived) return false;
      }
      if (attentionFilter === 'stale') {
        const d = (Date.now() - new Date(repo.lastUpdated).getTime()) / 86400000;
        if (d <= 180) return false;
      }

      // Sync status filter
      if (selectedSyncStatus !== 'all') {
        if (!repo.forkSync) return false;
        if (selectedSyncStatus === 'up-to-date' && repo.forkSync.state !== 'up-to-date') return false;
        if (selectedSyncStatus === 'behind' && repo.forkSync.state !== 'behind') return false;
        if (selectedSyncStatus === 'behind-100' && (repo.forkSync.state !== 'behind' || repo.forkSync.behindBy <= 100)) return false;
        if (selectedSyncStatus === 'ahead' && repo.forkSync.state !== 'ahead') return false;
        if (selectedSyncStatus === 'diverged' && repo.forkSync.state !== 'diverged') return false;
      }

      // Show outdated only (from sidebar button)
      if (showOutdatedOnly) {
        if (!repo.forkSync || repo.forkSync.behindBy === 0) return false;
      }

      // Category filter — normalize stale allCategories names before comparing
      if (selectedCategory) {
        const categoryName = normalizedCategories.find(c => c.id === selectedCategory)?.name;
        if (categoryName) {
          const normalizedRepoCats = repo.allCategories.map(c => CATEGORY_ALIASES[c] ?? c);
          if (!normalizedRepoCats.includes(categoryName)) return false;
        }
      }

      // AI Dev Skills filter
      if (selectedAiDevSkills.length > 0) {
        if (!selectedAiDevSkills.every(s => (repo.aiDevSkills ?? []).some(a => a.skill === s))) return false;
      }
      // PM Skills filter
      if (selectedPmSkills.length > 0) {
        if (!selectedPmSkills.every(s => (repo.pmSkills ?? []).includes(s))) return false;
      }
      const taxonomyByDimension = (dimension: string) =>
        (repo.taxonomy ?? [])
          .filter((entry) => entry.dimension === dimension)
          .map((entry) => entry.value);
      // Taxonomy dimension filters
      if (selectedAiTrends.length > 0) {
        const repoAiTrends = taxonomyByDimension('ai_trend');
        if (!selectedAiTrends.every((value) => repoAiTrends.includes(value))) return false;
      }
      if (selectedIndustries.length > 0) {
        const repoIndustries = taxonomyByDimension('industry');
        if (!selectedIndustries.every((value) => repoIndustries.includes(value))) return false;
      }
      if (selectedUseCases.length > 0) {
        const repoUseCases = taxonomyByDimension('use_case');
        if (!selectedUseCases.every((value) => repoUseCases.includes(value))) return false;
      }
      if (selectedModalities.length > 0) {
        const repoModalities = taxonomyByDimension('modality');
        if (!selectedModalities.every((value) => repoModalities.includes(value))) return false;
      }
      if (selectedDeploymentContexts.length > 0) {
        const repoDeploymentContexts = taxonomyByDimension('deployment_context');
        if (!selectedDeploymentContexts.every((value) => repoDeploymentContexts.includes(value))) return false;
      }
      // Builders filter
      if (selectedBuilders.length > 0) {
        if (!(repo.builders ?? []).some(b => selectedBuilders.includes(b.login))) return false;
      }

      return true;
    });

    // Apply sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'stars':
          return (b.parentStats?.stars ?? b.stars) - (a.parentStats?.stars ?? a.stars);
        case 'tags':
          return b.enrichedTags.length - a.enrichedTags.length;
        case 'alpha':
          return a.name.localeCompare(b.name);
        case 'oldest':
          return new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
        case 'most-outdated':
          return (b.forkSync?.behindBy ?? 0) - (a.forkSync?.behindBy ?? 0);
        case 'upstream-updated':
          return new Date(b.upstreamLastPushAt ?? 0).getTime() - new Date(a.upstreamLastPushAt ?? 0).getTime();
        case 'fork-oldest':
          return new Date(a.forkedAt ?? '9999').getTime() - new Date(b.forkedAt ?? '9999').getTime();
        case 'fork-newest':
          return new Date(b.forkedAt ?? 0).getTime() - new Date(a.forkedAt ?? 0).getTime();
        case 'updated':
        default:
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      }
    });
  }, [data, search, searchMode, semanticResults, selectedType, selectedLanguage, selectedLicense, selectedTags, selectedActivity, sortBy, attentionFilter, selectedSyncStatus, showOutdatedOnly, selectedCategory, selectedAiDevSkills, selectedPmSkills, selectedAiTrends, selectedIndustries, selectedUseCases, selectedModalities, selectedDeploymentContexts, selectedBuilders]);

  function clearFilters() {
    setSearch('');
    setSearchMode('keyword');
    setSemanticResults(null);
    setSelectedType('all');
    setSelectedLanguage('');
    setSelectedLicense('');
    setSelectedTags([]);
    setSelectedActivity('all');
    setSelectedSyncStatus('all');
    setAttentionFilter('all');
    setShowOutdatedOnly(false);
    setSelectedCategory('');
    setSelectedAiDevSkills([]);
    setSelectedPmSkills([]);
    setSelectedAiTrends([]);
    setSelectedIndustries([]);
    setSelectedUseCases([]);
    setSelectedModalities([]);
    setSelectedDeploymentContexts([]);
    setSelectedBuilders([]);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function removeTag(tag: string) {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }

  function toggleAiDevSkill(skill: string) {
    setSelectedAiDevSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
  }

  function togglePmSkill(skill: string) {
    setSelectedPmSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
  }

  function toggleIndustry(industry: string) {
    setSelectedIndustries(prev => prev.includes(industry) ? prev.filter(s => s !== industry) : [...prev, industry]);
  }

  function toggleAiTrend(value: string) {
    setSelectedAiTrends(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }

  function toggleUseCase(value: string) {
    setSelectedUseCases(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }

  function toggleModality(value: string) {
    setSelectedModalities(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }

  function toggleDeploymentContext(value: string) {
    setSelectedDeploymentContexts(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }

  function toggleBuilder(builder: string) {
    setSelectedBuilders(prev => prev.includes(builder) ? prev.filter(s => s !== builder) : [...prev, builder]);
  }

  function handleRepoClick(name: string) {
    setSearch(name);
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Stage 2 loading banner — fades in/out while owned repos stay visible */}
        <LoadingBanner visible={isLoadingFull} />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">Reporium</h1>
              <p className="text-sm text-zinc-500">
                {data ? `${data.username}'s GitHub Library` : 'Your GitHub Knowledge Library'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* API connected badge — production mode only */}
              {provider.mode === 'production' && (
                <span className="text-xs text-zinc-500 border border-zinc-700 rounded px-2 py-0.5">API connected</span>
              )}
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="lg:hidden rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {sidebarOpen ? 'Hide Panel' : 'Stats Panel'}
              </button>
            </div>
          </div>

          {/* Generic error */}
          {error && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-400">
              {error}
            </div>
          )}


          {/* Mini Ask — navigates to /ask for full query experience */}
          <MiniAskBar />

          <PortfolioInsightsWidget
            insights={portfolioInsights}
            onRepoClick={handleRepoClick}
          />

          <TrendingThisWeekWidget repos={trendingThisWeek} />

          <CrossDimensionWidget analytics={crossDimensionAnalytics} />

          {/* Stats */}
          {data && (
            <StatsBar
              data={data}
              tagMetrics={data.tagMetrics}
              onTagClick={(tag) => toggleTag(tag)}
            />
          )}

          {/* Search + Filter */}
          {data && (
            <>
              <SearchBar
                value={search}
                onChange={setSearch}
                searchMode={searchMode}
                onSearchModeChange={setSearchMode}
                resultCount={filteredAndSortedRepos.length}
                totalCount={data.repos.length}
              />
              {searchMode === 'semantic' && search.trim() && (
                <p className="text-xs text-zinc-500">
                  {isSearchingSemantic
                    ? 'Running semantic search against repo embeddings...'
                    : 'Showing semantic matches ranked by cosine similarity.'}
                </p>
              )}
              <FilterBar
                languages={allLanguages}
                allTags={allTags}
                tagMetrics={data.tagMetrics ?? []}
                selectedType={selectedType}
                selectedLanguage={selectedLanguage}
                selectedLicense={selectedLicense}
                selectedTags={selectedTags}
                selectedActivity={selectedActivity}
                selectedSyncStatus={selectedSyncStatus}
                sortBy={sortBy}
                categories={normalizedCategories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                onTypeChange={setSelectedType}
                onLanguageChange={setSelectedLanguage}
                onLicenseChange={setSelectedLicense}
                onTagToggle={toggleTag}
                onTagRemove={removeTag}
                onActivityChange={setSelectedActivity}
                onSyncStatusChange={setSelectedSyncStatus}
                onSortChange={setSortBy}
                onClear={clearFilters}
                filteredCount={filteredAndSortedRepos.length}
                aiDevSkillStats={data.aiDevSkillStats ?? []}
                pmSkillStats={data.pmSkillStats ?? []}
                builderStats={data.builderStats ?? []}
                aiTrendValues={aiTrendValues}
                industryValues={industryValues}
                useCaseValues={useCaseValues}
                modalityValues={modalityValues}
                deploymentContextValues={deploymentContextValues}
                selectedAiTrends={selectedAiTrends}
                selectedAiDevSkills={selectedAiDevSkills}
                selectedPmSkills={selectedPmSkills}
                selectedIndustries={selectedIndustries}
                selectedUseCases={selectedUseCases}
                selectedModalities={selectedModalities}
                selectedDeploymentContexts={selectedDeploymentContexts}
                selectedBuilders={selectedBuilders}
                onAiTrendToggle={toggleAiTrend}
                onAiDevSkillToggle={toggleAiDevSkill}
                onPmSkillToggle={togglePmSkill}
                onIndustryToggle={toggleIndustry}
                onUseCaseToggle={toggleUseCase}
                onModalityToggle={toggleModality}
                onDeploymentContextToggle={toggleDeploymentContext}
                onBuilderToggle={toggleBuilder}
                industryStats={industryStats}
                languageCounts={languageCounts}
                licenseCounts={licenseCounts}
              />
            </>
          )}

          {/* Grid */}
          {isLoading ? (
            <LoadingState />
          ) : (
            <RepoGrid repos={filteredAndSortedRepos} allRepos={data?.repos} onTagClick={toggleTag} onCategoryClick={(id) => setSelectedCategory(prev => prev === id ? '' : id)} />
          )}
        </div>
      </div>

      {/* ── Sidebar — persistent on desktop, slide-in on mobile ── */}
      {data && (
        <>
          {/* Desktop sidebar */}
          <aside className="hidden lg:flex flex-col w-[380px] shrink-0 border-l border-zinc-800 bg-zinc-950">
            <MetricsSidebar
              data={{ ...data, categories: normalizedCategories }}
              selectedTags={selectedTags}
              tagMetrics={data.tagMetrics ?? []}
              intersectionMetrics={intersectionMetrics}
              onTagClick={(tag) => { if (!selectedTags.includes(tag)) toggleTag(tag); }}
              onTagRemove={removeTag}
              onRepoClick={handleRepoClick}
              onViewArchived={() => setAttentionFilter('archived-parent')}
              onViewStale={() => setAttentionFilter('stale')}
              onViewOutdated={() => setShowOutdatedOnly(true)}
              onSyncFilter={(status) => setSelectedSyncStatus(status as typeof selectedSyncStatus)}
              onCategoryFilter={setSelectedCategory}
              selectedCategory={selectedCategory}
              trends={trends}
            />
          </aside>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div
                className="flex-1 bg-black/60"
                onClick={() => setSidebarOpen(false)}
              />
              <div className="w-[340px] border-l border-zinc-800 bg-zinc-950 overflow-y-auto">
                <MetricsSidebar
                  data={{ ...data, categories: normalizedCategories }}
                  selectedTags={selectedTags}
                  tagMetrics={data.tagMetrics ?? []}
                  intersectionMetrics={intersectionMetrics}
                  onTagClick={(tag) => { if (!selectedTags.includes(tag)) toggleTag(tag); }}
                  onTagRemove={removeTag}
                  onRepoClick={handleRepoClick}
                  onViewArchived={() => setAttentionFilter('archived-parent')}
                  onViewStale={() => setAttentionFilter('stale')}
                  onViewOutdated={() => setShowOutdatedOnly(true)}
                  onSyncFilter={(status) => setSelectedSyncStatus(status as typeof selectedSyncStatus)}
                  onCategoryFilter={setSelectedCategory}
                  selectedCategory={selectedCategory}
                  trends={trends}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
