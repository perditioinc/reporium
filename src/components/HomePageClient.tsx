'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { LibraryData, EnrichedRepo, SortOption } from '@/types/repo';
import type { TrendData } from '@/types/repo';
import { StatsBar } from '@/components/StatsBar';
import { SearchBar } from '@/components/SearchBar';
import { RepoGrid } from '@/components/RepoGrid';
import { LoadingState } from '@/components/LoadingState';
import { LoadingBanner } from '@/components/LoadingBanner';
import { MiniAskBar } from '@/components/MiniAskBar';
import { buildIntersectionMetrics } from '@/lib/buildTagMetrics';
import { createDataProvider, SearchMode, LoadProgress } from '@/lib/dataProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CategoryFilterBar } from '@/components/CategoryFilterBar';

// Lazy-load heavy components — they aren't needed for initial paint
const FilterBar = dynamic(() => import('@/components/FilterBar').then(m => ({ default: m.FilterBar })), { ssr: false });
const MetricsSidebar = dynamic(() => import('@/components/MetricsSidebar').then(m => ({ default: m.MetricsSidebar })), { ssr: false });
const LibraryInsightsWidget = dynamic(() => import('@/components/LibraryInsightsWidget').then(m => ({ default: m.LibraryInsightsWidget })), { ssr: false });
const CrossDimensionWidget = dynamic(() => import('@/components/CrossDimensionWidget').then(m => ({ default: m.CrossDimensionWidget })), { ssr: false });



const provider = createDataProvider();

/** Main library page */
export function HomePageClient() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  // portfolioInsights kept for future use when API returns enriched data
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
  const [selectedDbCategory, setSelectedDbCategory] = useState(''); // KAN-57: 16-category DB filter

  // New taxonomy filter state
  const [selectedAiDevSkills, setSelectedAiDevSkills] = useState<string[]>([]);
  const [selectedPmSkills, setSelectedPmSkills] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedAiTrends, setSelectedAiTrends] = useState<string[]>([]);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
  const [selectedDeploymentContexts, setSelectedDeploymentContexts] = useState<string[]>([]);
  const [selectedBuilders, setSelectedBuilders] = useState<string[]>([]);

  // Security risk + Claude Plugin filter state
  const [showClaudePluginsOnly, setShowClaudePluginsOnly] = useState(false);
  const [selectedSecurityRisk, setSelectedSecurityRisk] = useState<'all' | 'incident' | 'critical' | 'high' | 'medium' | 'low'>('all');

  /** Tags that identify MCP servers and Claude plugins (must stay in sync with RepoCard.tsx) */
  const MCP_PLUGIN_TAGS = new Set([
    'mcp', 'mcp-server', 'mcp-client', 'mcp-tool',
    'model-context-protocol', 'modelcontextprotocol',
    'claude-mcp', 'claude-plugin', 'claude-tools', 'claude-app',
  ]);
  const [aiTrendValues, setAiTrendValues] = useState<Awaited<ReturnType<typeof provider.getTaxonomyValues>>>([]);
  const [industryValues, setIndustryValues] = useState<Awaited<ReturnType<typeof provider.getTaxonomyValues>>>([]);
  const [useCaseValues, setUseCaseValues] = useState<Awaited<ReturnType<typeof provider.getTaxonomyValues>>>([]);
  const [modalityValues, setModalityValues] = useState<Awaited<ReturnType<typeof provider.getTaxonomyValues>>>([]);
  const [deploymentContextValues, setDeploymentContextValues] = useState<Awaited<ReturnType<typeof provider.getTaxonomyValues>>>([]);

  // API degraded state — true when production mode but data came from JSON fallback
  const [apiDegraded, setApiDegraded] = useState(false);

  // Mobile sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<'normal' | 'minimized' | 'fullscreen'>('normal');

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
      const categoryParam = params.get('category');
      if (categoryParam) {
        setSelectedDbCategory(categoryParam);
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

  // KAN-57: sync ?category= URL param when selectedDbCategory changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (selectedDbCategory) {
      params.set('category', selectedDbCategory);
    } else {
      params.delete('category');
    }
    const newSearch = params.toString();
    const newUrl = newSearch ? `?${newSearch}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [selectedDbCategory]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setApiDegraded(false);
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
        const full = await provider.getLibrary((p) => {
          if (!cancelled) setLoadProgress(p);
        });
        if (!cancelled) {
          setData(full);
          setIsLoadingFull(false);
          // Degraded: production mode but API fell back to JSON
          setApiDegraded(provider.getDegradedState());
        }
        // Non-blocking extras
        if (!cancelled) setLoadProgress({ stage: 'trends', percent: 50, detail: 'Loading trends…' });
        provider.getTrends()
          .then(t => { if (!cancelled && t) setTrends(t); })
          .catch(() => {});
        // portfolio insights retained for future API-driven intelligence
        if (!cancelled) setLoadProgress({ stage: 'taxonomy', percent: 75, detail: 'Loading taxonomy…' });
        provider.getCrossDimensionAnalytics('industry', 'ai_trend', 50)
          .then(analytics => { if (!cancelled) setCrossDimensionAnalytics(analytics); })
          .catch(() => {});
        if (!cancelled) setLoadProgress({ stage: 'ready', percent: 100, detail: 'Ready' });
      } catch (e) {
        if (!cancelled) {
          setIsLoadingFull(false);
          setLoadProgress({ stage: 'error', percent: 0, detail: 'Failed to load' });
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

  // Stable sidebar data object — only recalculates when data or categories change
  const sidebarData = useMemo(() => {
    if (!data) return null;
    return { ...data, categories: normalizedCategories };
  }, [data, normalizedCategories]);

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

      // KAN-57: DB 16-category filter (agents, rag-retrieval, llm-serving, etc.)
      if (selectedDbCategory) {
        if (repo.dbCategory !== selectedDbCategory) return false;
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

      // Claude Plugins / MCP filter
      if (showClaudePluginsOnly) {
        const lowerName = repo.name.toLowerCase();
        const lowerDesc = (repo.description ?? '').toLowerCase();
        const lowerTags = (repo.enrichedTags ?? []).map(t => t.toLowerCase());
        const isMCP =
          lowerTags.some(t => MCP_PLUGIN_TAGS.has(t)) ||
          lowerName.startsWith('mcp-') ||
          lowerName.endsWith('-mcp') ||
          lowerName.includes('-mcp-') ||
          lowerName.includes('mcp_') ||
          lowerName.includes('_mcp') ||
          /\bplugin\b/.test(lowerName) ||
          /\bmcp\b/.test(lowerDesc) ||
          lowerDesc.includes('model context protocol') ||
          lowerDesc.includes('mcp server') ||
          lowerDesc.includes('mcp client') ||
          lowerDesc.includes('mcp tool') ||
          lowerDesc.includes('mcp-based') ||
          lowerDesc.includes('claude plugin') ||
          lowerDesc.includes('claude code plugin') ||
          lowerDesc.includes('claude skill');
        if (!isMCP) return false;
      }

      // Security risk filter
      if (selectedSecurityRisk !== 'all') {
        const sig = repo.securitySignals;
        if (selectedSecurityRisk === 'incident' && !sig?.incident_reported) return false;
        if (selectedSecurityRisk === 'critical' && sig?.risk_level !== 'critical') return false;
        if (selectedSecurityRisk === 'high'     && sig?.risk_level !== 'high')     return false;
        if (selectedSecurityRisk === 'medium'   && sig?.risk_level !== 'medium')   return false;
        if (selectedSecurityRisk === 'low'      && sig?.risk_level !== 'low')      return false;
      }

      return true;
    });

    /** Trending score 0-5 for sort — mirrors RepoCard.tsx getTrendingScore */
    const trendScore = (r: EnrichedRepo) => {
      const c7 = r.commitStats?.last7Days ?? 0;
      const c30 = r.commitStats?.last30Days ?? 0;
      if (c7 >= 20) return 5;
      if (c7 >= 10) return 4;
      if (c7 >=  4) return 3;
      if (c7 >=  2) return 2;
      if (c7 >=  1 || c30 >= 8) return 1;
      return 0;
    };

    /** Health score 0-4 for sort — mirrors RepoCard.tsx getLifeStatus */
    const healthScore = (r: EnrichedRepo) => {
      const c7  = r.commitStats?.last7Days  ?? 0;
      const c30 = r.commitStats?.last30Days ?? 0;
      const c90 = r.commitStats?.last90Days ?? 0;
      const stars = r.parentStats?.stars ?? r.stars ?? 0;
      const daysSince = (Date.now() - new Date(r.lastUpdated).getTime()) / 86400000;
      if (r.parentStats?.isArchived) return 0;
      if (c7 >= 10 || c30 >= 30)    return 4; // Hot
      if (c30 > 0)                  return 3; // Active
      if (c90 > 0)                  return 2; // Stable
      if (stars > 500 || daysSince < 365) return 1; // Dormant but useful
      return 0; // Inactive
    };

    // Apply sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'trending':
          return trendScore(b) - trendScore(a) || (b.commitStats?.last7Days ?? 0) - (a.commitStats?.last7Days ?? 0);
        case 'health':
          return healthScore(b) - healthScore(a) || (b.commitStats?.last30Days ?? 0) - (a.commitStats?.last30Days ?? 0);
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
  }, [data, search, searchMode, semanticResults, selectedType, selectedLanguage, selectedLicense, selectedTags, selectedActivity, sortBy, attentionFilter, selectedSyncStatus, showOutdatedOnly, selectedCategory, selectedDbCategory, selectedAiDevSkills, selectedPmSkills, selectedAiTrends, selectedIndustries, selectedUseCases, selectedModalities, selectedDeploymentContexts, selectedBuilders, showClaudePluginsOnly, selectedSecurityRisk]);

  const clearFilters = useCallback(() => {
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
    setShowClaudePluginsOnly(false);
    setSelectedSecurityRisk('all');
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const removeTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const toggleAiDevSkill = useCallback((skill: string) => {
    setSelectedAiDevSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
  }, []);

  const togglePmSkill = useCallback((skill: string) => {
    setSelectedPmSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
  }, []);

  const toggleIndustry = useCallback((industry: string) => {
    setSelectedIndustries(prev => prev.includes(industry) ? prev.filter(s => s !== industry) : [...prev, industry]);
  }, []);

  const toggleAiTrend = useCallback((value: string) => {
    setSelectedAiTrends(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }, []);

  const toggleUseCase = useCallback((value: string) => {
    setSelectedUseCases(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }, []);

  const toggleModality = useCallback((value: string) => {
    setSelectedModalities(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }, []);

  const toggleDeploymentContext = useCallback((value: string) => {
    setSelectedDeploymentContexts(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }, []);

  const toggleBuilder = useCallback((builder: string) => {
    setSelectedBuilders(prev => prev.includes(builder) ? prev.filter(s => s !== builder) : [...prev, builder]);
  }, []);

  const handleRepoClick = useCallback((name: string) => {
    setSearch(name);
    setSidebarOpen(false);
  }, []);

  // Stable callbacks for MetricsSidebar
  const handleSidebarTagClick = useCallback((tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev : [...prev, tag]);
  }, []);
  const handleViewArchived = useCallback(() => setAttentionFilter('archived-parent'), []);
  const handleViewStale = useCallback(() => setAttentionFilter('stale'), []);
  const handleViewOutdated = useCallback(() => setShowOutdatedOnly(true), []);
  const handleSyncFilter = useCallback((status: string) => setSelectedSyncStatus(status as typeof selectedSyncStatus), []);
  const handlePluginToggle = useCallback(() => setShowClaudePluginsOnly(v => !v), []);
  const handleCategoryClick = useCallback((id: string) => setSelectedCategory(prev => prev === id ? '' : id), []);

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Stage 2 loading banner — fades in/out while owned repos stay visible */}
        <LoadingBanner visible={isLoadingFull} progress={loadProgress} />
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Reporium</h1>
              <p className="text-sm text-zinc-500">
                {data ? `${data.username}'s GitHub Library` : 'Your GitHub Knowledge Library'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Nav links */}
              <nav className="hidden sm:flex items-center gap-2 text-xs text-zinc-500">
                <Link href="/trends" className="hover:text-zinc-300 transition-colors">Trends</Link>
                <span>·</span>
                <Link href="/insights" className="hover:text-zinc-300 transition-colors">Insights</Link>
                <span>·</span>
                <Link href="/wiki" className="hover:text-zinc-300 transition-colors">Wiki</Link>
              </nav>
              {/* Dashboard view controls */}
              <div className="flex items-center border border-zinc-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setDashboardMode(dashboardMode === 'minimized' ? 'normal' : 'minimized')}
                  title={dashboardMode === 'minimized' ? 'Expand dashboard' : 'Minimize dashboard'}
                  className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  {dashboardMode === 'minimized' ? '▢' : '▬'}
                </button>
                <button
                  onClick={() => setDashboardMode(dashboardMode === 'fullscreen' ? 'normal' : 'fullscreen')}
                  title={dashboardMode === 'fullscreen' ? 'Exit fullscreen' : 'Fullscreen'}
                  className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors border-l border-zinc-700"
                >
                  {dashboardMode === 'fullscreen' ? '⊡' : '⛶'}
                </button>
              </div>
              {/* Live API status badge */}
              {provider.mode === 'production' && (
                <span className={[
                  'text-xs border rounded px-2 py-0.5 flex items-center gap-1.5 transition-colors duration-300',
                  loadProgress?.stage === 'ready'
                    ? 'text-emerald-400 border-emerald-800/60'
                    : loadProgress?.stage === 'error'
                    ? 'text-amber-400 border-amber-800/60'
                    : 'text-blue-400 border-blue-800/60',
                ].join(' ')}>
                  {/* Status dot */}
                  {loadProgress?.stage === 'ready' ? (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  ) : loadProgress?.stage === 'error' ? (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  ) : (
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                    </span>
                  )}
                  {loadProgress?.stage === 'ready'
                    ? 'API ready'
                    : loadProgress?.stage === 'error'
                    ? 'Cached mode'
                    : loadProgress?.stage === 'repos'
                    ? 'Loading repos…'
                    : loadProgress?.stage === 'trends'
                    ? 'Loading trends…'
                    : loadProgress?.stage === 'taxonomy'
                    ? 'Loading taxonomy…'
                    : 'Connecting…'}
                </span>
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

          {apiDegraded && (
            <div className="flex items-start justify-between gap-4 rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
              <p>Live data is unavailable right now — showing your last cached snapshot.</p>
              <button
                type="button"
                onClick={() => setApiDegraded(false)}
                className="shrink-0 rounded border border-amber-800/60 px-2 py-1 text-xs text-amber-100 transition-colors hover:bg-amber-900/30"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Stats — library overview, languages, builders, AI dev coverage, tag cloud */}
          {dashboardMode !== 'minimized' && data && (
            <StatsBar
              data={data}
              tagMetrics={data.tagMetrics}
              onTagClick={toggleTag}
            />
          )}

          {/* Mini Ask — sticky as user scrolls */}
          <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-2 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800/50">
            <MiniAskBar />
          </div>

          {dashboardMode !== 'minimized' && (
            <>
              <ErrorBoundary fallback={<div className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-400">Library Insights unavailable.</div>}>
                {data && (
                  <LibraryInsightsWidget
                    repos={data.repos}
                    onTagClick={toggleTag}
                  />
                )}
              </ErrorBoundary>

              <CrossDimensionWidget analytics={crossDimensionAnalytics} repos={data?.repos} />
            </>
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
                showClaudePluginsOnly={showClaudePluginsOnly}
                onPluginToggle={handlePluginToggle}
                selectedSecurityRisk={selectedSecurityRisk}
                onSecurityRiskChange={setSelectedSecurityRisk}
              />
            </>
          )}

          {/* KAN-57: 16-category filter chips */}
          {data && !isLoading && (
            <CategoryFilterBar
              repos={data.repos}
              selected={selectedDbCategory}
              onSelect={setSelectedDbCategory}
            />
          )}

          {/* Grid */}
          <ErrorBoundary fallback={<div className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-400">Repo grid unavailable.</div>}>
            {isLoading ? (
              <LoadingState />
            ) : (
              <RepoGrid repos={filteredAndSortedRepos} allRepos={data?.repos} onTagClick={toggleTag} onCategoryClick={handleCategoryClick} />
            )}
          </ErrorBoundary>
        </div>
      </div>

      {/* ── Sidebar — persistent on desktop, slide-in on mobile ── */}
      {data && (
        <>
          {/* Desktop sidebar */}
          <aside className="hidden lg:flex flex-col w-[380px] shrink-0 border-l border-zinc-800 bg-zinc-950">
            <ErrorBoundary fallback={<div className="rounded-lg border border-zinc-700 bg-zinc-800 m-4 px-4 py-3 text-sm text-zinc-400">Metrics sidebar unavailable.</div>}>
              <MetricsSidebar
                data={sidebarData!}
                selectedTags={selectedTags}
                tagMetrics={data.tagMetrics ?? []}
                intersectionMetrics={intersectionMetrics}
                onTagClick={handleSidebarTagClick}
                onTagRemove={removeTag}
                onRepoClick={handleRepoClick}
                onViewArchived={handleViewArchived}
                onViewStale={handleViewStale}
                onViewOutdated={handleViewOutdated}
                onSyncFilter={handleSyncFilter}
                onCategoryFilter={setSelectedCategory}
                selectedCategory={selectedCategory}
                trends={trends}
              />
            </ErrorBoundary>
          </aside>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div
                className="flex-1 bg-black/60"
                onClick={() => setSidebarOpen(false)}
              />
              <div className="w-[340px] border-l border-zinc-800 bg-zinc-950 overflow-y-auto">
                <ErrorBoundary fallback={<div className="rounded-lg border border-zinc-700 bg-zinc-800 m-4 px-4 py-3 text-sm text-zinc-400">Metrics sidebar unavailable.</div>}>
                  <MetricsSidebar
                    data={sidebarData!}
                    selectedTags={selectedTags}
                    tagMetrics={data.tagMetrics ?? []}
                    intersectionMetrics={intersectionMetrics}
                    onTagClick={handleSidebarTagClick}
                    onTagRemove={removeTag}
                    onRepoClick={handleRepoClick}
                    onViewArchived={handleViewArchived}
                    onViewStale={handleViewStale}
                    onViewOutdated={handleViewOutdated}
                    onSyncFilter={handleSyncFilter}
                    onCategoryFilter={setSelectedCategory}
                    selectedCategory={selectedCategory}
                    trends={trends}
                  />
                </ErrorBoundary>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
