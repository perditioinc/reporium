'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LibraryData, EnrichedRepo, SortOption } from '@/types/repo';
import type { TrendData } from '@/types/repo';
import { StatsBar } from '@/components/StatsBar';
import { SearchBar } from '@/components/SearchBar';

import { RepoCardMinimal } from '@/components/RepoCardMinimal';
// RepoDetailPanel replaced by inline expansion in grid
import { LoadingState } from '@/components/LoadingState';
import { LoadingBanner } from '@/components/LoadingBanner';
import { buildIntersectionMetrics } from '@/lib/buildTagMetrics';
import { createDataProvider, SearchMode, LoadProgress } from '@/lib/dataProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CategoryFilterBar } from '@/components/CategoryFilterBar';
import type { NLFilterResult } from '@/types/repo';

// Lazy-load heavy components — they aren't needed for initial paint
const FilterBar = dynamic(() => import('@/components/FilterBar').then(m => ({ default: m.FilterBar })), { ssr: false });
const MetricsSidebar = dynamic(() => import('@/components/MetricsSidebar').then(m => ({ default: m.MetricsSidebar })), { ssr: false });
const LibraryInsightsWidget = dynamic(() => import('@/components/LibraryInsightsWidget').then(m => ({ default: m.LibraryInsightsWidget })), { ssr: false });
const CrossDimensionWidget = dynamic(() => import('@/components/CrossDimensionWidget').then(m => ({ default: m.CrossDimensionWidget })), { ssr: false });
const RecommendationsWidget = dynamic(() => import('@/components/RecommendationsWidget').then(m => ({ default: m.RecommendationsWidget })), { ssr: false });
const HomeGraphWidget = dynamic(() => import('@/components/HomeGraphWidget').then(m => ({ default: m.HomeGraphWidget })), { ssr: false });



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

  // KAN-159: NL filter state
  const [nlFilterInterpretation, setNlFilterInterpretation] = useState<string | null>(null);
  const [nlMinStars, setNlMinStars] = useState<number | null>(null);
  const [nlExcludeArchived, setNlExcludeArchived] = useState(false);

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

  // Widget tabs — only one expanded at a time, null = all collapsed
  const [activeWidget, setActiveWidget] = useState<'stats' | 'insights' | 'analytics' | 'dashboard' | null>(null);
  const toggleWidget = useCallback((w: 'stats' | 'insights' | 'analytics' | 'dashboard') => {
    setActiveWidget(prev => prev === w ? null : w);
  }, []);

  // Filters collapsed by default — clean home page, filters accessible via toggle
  const [filtersOpen, setFiltersOpen] = useState(false);

  // KAN-84: Explore mode (always on)
  const [selectedRepoName, setSelectedRepoName] = useState<string | null>(null);

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

  // Count active filters for the toggle badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedType !== 'all') count++;
    if (selectedLanguage) count++;
    if (selectedLicense) count++;
    if (selectedTags.length > 0) count += selectedTags.length;
    if (selectedActivity !== 'all') count++;
    if (selectedSyncStatus !== 'all') count++;
    if (selectedCategory) count++;
    if (selectedDbCategory) count++;
    if (selectedAiDevSkills.length > 0) count++;
    if (selectedPmSkills.length > 0) count++;
    if (selectedAiTrends.length > 0) count++;
    if (selectedIndustries.length > 0) count++;
    if (selectedUseCases.length > 0) count++;
    if (selectedModalities.length > 0) count++;
    if (selectedDeploymentContexts.length > 0) count++;
    if (selectedBuilders.length > 0) count++;
    if (showClaudePluginsOnly) count++;
    if (selectedSecurityRisk !== 'all') count++;
    return count;
  }, [selectedType, selectedLanguage, selectedLicense, selectedTags, selectedActivity, selectedSyncStatus, selectedCategory, selectedDbCategory, selectedAiDevSkills, selectedPmSkills, selectedAiTrends, selectedIndustries, selectedUseCases, selectedModalities, selectedDeploymentContexts, selectedBuilders, showClaudePluginsOnly, selectedSecurityRisk]);

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

      // KAN-159: NL filter — min stars
      if (nlMinStars !== null) {
        const repoStars = repo.parentStats?.stars ?? repo.stars ?? 0;
        if (repoStars < nlMinStars) return false;
      }
      // KAN-159: NL filter — exclude archived
      if (nlExcludeArchived && repo.isArchived) return false;

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

  // KAN-159: apply NL filter result to existing filter state
  const handleNLFilter = useCallback((result: NLFilterResult) => {
    setNlFilterInterpretation(result.interpretation);
    setNlMinStars(result.min_stars ?? null);
    setNlExcludeArchived(result.exclude_archived);
    if (result.language) setSelectedLanguage(result.language);
    if (result.category) setSelectedDbCategory(result.category);
    if (result.sort === 'stars') setSortBy('stars' as SortOption);
    else if (result.sort === 'updated') setSortBy('updated' as SortOption);
    // Don't apply NL tags to strict tag filter — too granular, causes 0-result false negatives
  }, []);

  const handleNLFilterClear = useCallback(() => {
    setNlFilterInterpretation(null);
    setNlMinStars(null);
    setNlExcludeArchived(false);
  }, []);

  // KAN-84: explore mode handlers
  const router = useRouter();
  const handleExploreSelect = useCallback((name: string) => {
    setSelectedRepoName(prev => (prev === name ? null : name));
  }, []);
  const handleExploreClose = useCallback(() => { setSelectedRepoName(null); setExpandedSections({}); }, []);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = useCallback((key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] })), []);
  const expandedCardRef = React.useRef<HTMLDivElement>(null);

  // Close expanded card when clicking outside it
  useEffect(() => {
    if (!selectedRepoName) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (expandedCardRef.current && !expandedCardRef.current.contains(e.target as Node)) {
        setSelectedRepoName(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedRepoName]);
  const handleOpenRepo = useCallback((name: string) => {
    router.push(`/repo/${name}`);
  }, [router]);

  // Related repos: same dbCategory as selected repo
  const selectedRepo = useMemo(
    () => (selectedRepoName ? filteredAndSortedRepos.find(r => r.name === selectedRepoName) ?? null : null),
    [selectedRepoName, filteredAndSortedRepos],
  );
  const relatedRepos = useMemo(() => {
    if (!selectedRepo) return [];
    const cat = selectedRepo.dbCategory;
    if (!cat) return [];
    return filteredAndSortedRepos.filter(r => r.name !== selectedRepo.name && r.dbCategory === cat).slice(0, 4);
  }, [selectedRepo, filteredAndSortedRepos]);
  const relatedNames = useMemo(() => new Set(relatedRepos.map(r => r.name)), [relatedRepos]);

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Stage 2 loading banner — fades in/out while owned repos stay visible */}
        <LoadingBanner visible={isLoadingFull} progress={loadProgress} />

        <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-5">

          {/* Widget tabs — sticky at top */}
          {data && (
            <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-sm -mx-3 sm:-mx-4 md:-mx-6 border-b border-zinc-800">
              <div className="flex">
                {([
                  { key: 'stats', label: 'Stats' },
                  { key: 'insights', label: 'Insights' },
                  { key: 'analytics', label: 'Analytics' },
                  { key: 'dashboard', label: 'Dashboard' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleWidget(key)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeWidget === key
                        ? 'text-purple-300 bg-purple-500/10 border-b-2 border-purple-500'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Generic error */}
          {error && (
            <div className="mx-3 sm:mx-4 md:mx-6 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {apiDegraded && (
            <div className="mx-3 sm:mx-4 md:mx-6 flex items-start justify-between gap-4 rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
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

          {/* Widget content panels */}
          {data && activeWidget === 'stats' && (
            <div className="mx-3 sm:mx-4 md:mx-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <StatsBar data={data} tagMetrics={data.tagMetrics} onTagClick={toggleTag} />
            </div>
          )}
          {data && activeWidget === 'insights' && (
            <div className="mx-3 sm:mx-4 md:mx-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <ErrorBoundary fallback={null}>
                <LibraryInsightsWidget repos={data.repos} onTagClick={toggleTag} />
              </ErrorBoundary>
            </div>
          )}
          {data && activeWidget === 'analytics' && (
            <div className="mx-3 sm:mx-4 md:mx-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <CrossDimensionWidget analytics={crossDimensionAnalytics} repos={data?.repos} />
            </div>
          )}
          {data && activeWidget === 'dashboard' && (
            <div className="mx-3 sm:mx-4 md:mx-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <ErrorBoundary fallback={null}>
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
          )}

          {/* Knowledge Graph */}
          <div className="px-3 sm:px-4 md:px-6">
            <ErrorBoundary fallback={null}>
              <HomeGraphWidget />
            </ErrorBoundary>
          </div>

          {/* Filter bar — sticky below widget tabs */}
          {data && (
            <div className="sticky top-7 z-20 bg-zinc-950/95 backdrop-blur-sm -mx-3 sm:-mx-4 md:-mx-6">
              <div className="flex items-center justify-start sm:justify-center gap-1 sm:gap-2 px-2 sm:px-4 md:px-6 py-1.5 border-b border-zinc-800/50 overflow-x-auto sm:overflow-x-visible">
                  <button
                    onClick={() => setFiltersOpen(v => !v)}
                    className={`flex items-center gap-1 sm:gap-1.5 rounded-lg border px-1.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium transition-colors shrink-0 ${
                      filtersOpen || activeFilterCount > 0
                        ? 'border-purple-500/50 bg-purple-500/10 text-purple-300'
                        : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <span className="hidden sm:inline">Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-purple-500 px-1 text-[10px] font-bold text-white">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                    >
                      Clear
                    </button>
                  )}
                  {/* Quick category shortcuts — emoji on mobile, full label on desktop */}
                  {[
                    { label: 'Agents', emoji: '🤖', value: 'agents' },
                    { label: 'RAG', emoji: '🔍', value: 'rag-retrieval' },
                    { label: 'LLM', emoji: '⚡', value: 'llm-serving' },
                    { label: 'Code Gen', emoji: '💻', value: 'code-generation' },
                    { label: 'Orchestration', emoji: '🔀', value: 'orchestration' },
                    { label: 'NLP', emoji: '📝', value: 'nlp-text' },
                    { label: 'Vision', emoji: '👁', value: 'computer-vision' },
                    { label: 'Data', emoji: '⚙️', value: 'data-processing' },
                    { label: 'Infra', emoji: '🏗️', value: 'infrastructure' },
                  ].map(shortcut => {
                    const isActive = selectedDbCategory === shortcut.value;
                    return (
                      <button
                        key={shortcut.label}
                        onClick={() => setSelectedDbCategory(prev => prev === shortcut.value ? '' : shortcut.value)}
                        className={`inline-flex items-center gap-1 px-1 sm:px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors shrink-0 ${
                          isActive
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 border border-transparent'
                        }`}
                        title={shortcut.label}
                      >
                        <span className="text-sm sm:text-[10px]">{shortcut.emoji}</span>
                        <span className="hidden sm:inline">{shortcut.label}</span>
                      </button>
                    );
                  })}
                  <span className="hidden sm:inline text-xs text-zinc-500 shrink-0">{filteredAndSortedRepos.length} of {data.repos.length}</span>
                  <span className="sm:hidden text-[10px] text-zinc-500 shrink-0 text-center leading-tight">
                    <span className="block font-medium text-zinc-400">{filteredAndSortedRepos.length}</span>
                    <span className="block text-[9px]">{data.repos.length}</span>
                  </span>
              </div>

              {/* Expandable filter panel */}
              {filtersOpen && (
                <div className="max-h-[60vh] overflow-y-auto space-y-3 border-t border-zinc-800/50 bg-zinc-900/95 px-3 sm:px-4 md:px-6 py-3">
                  <CategoryFilterBar
                    repos={data.repos}
                    selected={selectedDbCategory}
                    onSelect={setSelectedDbCategory}
                  />
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
                </div>
              )}
            </div>
          )}

          {/* Grid — explore mode with inline expansion */}
          <div className="px-3 sm:px-4 md:px-6">
          <ErrorBoundary fallback={<div className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-400">Repo grid unavailable.</div>}>
            {isLoading ? (
              <LoadingState />
            ) : (
              <motion.div
                layout
                className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              >
                {filteredAndSortedRepos.map(repo => {
                  const isSelected = repo.name === selectedRepoName;
                  return (
                    <React.Fragment key={repo.id}>
                      {/* When selected: replace mini card with expanded detail spanning full row */}
                      {isSelected && selectedRepo ? (
                        <motion.div
                          ref={expandedCardRef}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2 }}
                          className="sticky top-10 z-10"
                          style={{ gridColumn: '1 / -1' }}
                        >
                          <div className="rounded-xl border border-purple-500/30 bg-zinc-900/80 p-3 sm:p-4 space-y-2 sm:space-y-3">
                            {/* Header: name + badges + close */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                  <h3 className="text-sm sm:text-base font-bold text-zinc-100 break-words">{selectedRepo.name}</h3>
                                  {selectedRepo.dbCategory && (
                                    <span className="text-[10px] sm:text-[11px] font-medium text-purple-300 bg-purple-500/15 border border-purple-500/30 rounded-full px-1.5 sm:px-2 py-0.5 uppercase tracking-wide">
                                      {selectedRepo.dbCategory}
                                    </span>
                                  )}
                                  {selectedRepo.language && (
                                    <span className="text-[10px] sm:text-[11px] text-zinc-500 bg-zinc-800 rounded-full px-1.5 sm:px-2 py-0.5">{selectedRepo.language}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={handleExploreClose}
                                className="shrink-0 w-7 h-7 rounded-md border border-zinc-700 text-zinc-500 hover:text-zinc-300 flex items-center justify-center text-sm"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Description — full text, no clamp */}
                            {selectedRepo.description && (
                              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{selectedRepo.description}</p>
                            )}

                            {/* Builder + stats row */}
                            <div className="flex gap-3 sm:gap-4 flex-wrap items-center text-xs sm:text-[13px] text-zinc-400">
                              {selectedRepo.isFork && selectedRepo.parentStats?.owner && (
                                <span className="text-zinc-300">by <span className="font-medium">{selectedRepo.parentStats.owner}</span></span>
                              )}
                              {!selectedRepo.isFork && (
                                <span className="text-zinc-300">by <span className="font-medium">{selectedRepo.fullName.split('/')[0]}</span></span>
                              )}
                              {(selectedRepo.parentStats?.stars ?? selectedRepo.stars ?? 0) > 0 && (
                                <span>★ {(() => { const s = selectedRepo.parentStats?.stars ?? selectedRepo.stars ?? 0; return s >= 1000 ? `${(s/1000).toFixed(1)}k` : s; })()} stars</span>
                              )}
                              {(selectedRepo.parentStats?.forks ?? selectedRepo.forks ?? 0) > 0 && (
                                <span>⑂ {(() => { const f = selectedRepo.parentStats?.forks ?? selectedRepo.forks ?? 0; return f >= 1000 ? `${(f/1000).toFixed(1)}k` : f; })()} forks</span>
                              )}
                              <a
                                href={selectedRepo.isFork && selectedRepo.parentStats?.url ? selectedRepo.parentStats.url : selectedRepo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                                GitHub
                              </a>
                            </div>

                            {/* Tags — expandable on mobile, always visible on desktop */}
                            {selectedRepo.enrichedTags.length > 0 && (
                              <div>
                                <button
                                  onClick={() => toggleSection('tags')}
                                  className="sm:hidden flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1"
                                >
                                  Tags ({selectedRepo.enrichedTags.length})
                                  <svg className={`w-3 h-3 transition-transform ${expandedSections.tags ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                <div className={`${expandedSections.tags ? 'flex flex-wrap' : 'hidden'} sm:flex sm:flex-wrap gap-1.5`}>
                                  {selectedRepo.enrichedTags.map(tag => {
                                    const isProtocol = /^(mcp|a2a|cli|sdk|api|grpc|rest|graphql|websocket|model-context-protocol)$/i.test(tag);
                                    return (
                                      <span
                                        key={tag}
                                        className={`text-[10px] sm:text-[11px] rounded-full px-2 py-0.5 ${
                                          isProtocol
                                            ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 font-medium'
                                            : 'text-zinc-400 bg-zinc-800/80 border border-zinc-700'
                                        }`}
                                      >
                                        {tag}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Related repos — expandable on mobile */}
                            {relatedRepos.length > 0 && (
                              <div>
                                <button
                                  onClick={() => toggleSection('related')}
                                  className="sm:hidden flex items-center gap-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1"
                                >
                                  Related ({relatedRepos.length})
                                  <svg className={`w-3 h-3 transition-transform ${expandedSections.related ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                <p className="hidden sm:block text-[11px] font-semibold text-zinc-600 uppercase tracking-wider mb-1">Related</p>
                                <div className={`${expandedSections.related ? 'flex flex-wrap' : 'hidden'} sm:flex sm:flex-wrap gap-1.5`}>
                                  {relatedRepos.map(r => (
                                    <button
                                      key={r.name}
                                      onClick={() => handleExploreSelect(r.name)}
                                      className="text-[11px] sm:text-xs text-purple-300 bg-purple-500/10 border border-purple-500/25 rounded-md px-2 sm:px-2.5 py-1 hover:bg-purple-500/20 transition-colors"
                                    >
                                      {r.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Open full page */}
                            <Link
                              href={`/repo/${selectedRepo.name}`}
                              className="inline-block mt-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors"
                            >
                              Open full page →
                            </Link>
                          </div>
                        </motion.div>
                      ) : (
                        <RepoCardMinimal
                          repo={repo}
                          onSelect={handleExploreSelect}
                          isSelected={false}
                          isRelated={relatedNames.has(repo.name)}
                          anySelected={selectedRepoName !== null}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </motion.div>
            )}
          </ErrorBoundary>
          </div>

          {/* Footer */}
          <footer className="mx-3 sm:mx-4 md:mx-6 mt-8 border-t border-zinc-800 pt-6 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs text-zinc-500">
              <div>
                <h4 className="text-zinc-300 font-medium mb-2">Explore</h4>
                <ul className="space-y-1.5">
                  <li><Link href="/graph" className="hover:text-zinc-300 transition-colors">Knowledge Graph</Link></li>
                  <li><Link href="/trends" className="hover:text-zinc-300 transition-colors">Trends</Link></li>
                  <li><Link href="/stacks" className="hover:text-zinc-300 transition-colors">Tech Stacks</Link></li>
                  <li><Link href="/taxonomy" className="hover:text-zinc-300 transition-colors">Taxonomy</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-zinc-300 font-medium mb-2">Intelligence</h4>
                <ul className="space-y-1.5">
                  <li><Link href="/insights" className="hover:text-zinc-300 transition-colors">Insights</Link></li>
                  <li><Link href="/runs" className="hover:text-zinc-300 transition-colors">Run History</Link></li>
                  <li><Link href="/wiki" className="hover:text-zinc-300 transition-colors">Wiki</Link></li>
                  <li><Link href="/wiki/digest" className="hover:text-zinc-300 transition-colors">Daily Digest</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-zinc-300 font-medium mb-2">Wiki</h4>
                <ul className="space-y-1.5">
                  <li><Link href="/wiki/roadmap" className="hover:text-zinc-300 transition-colors">Roadmap</Link></li>
                  <li><Link href="/wiki/categories/transformer-architecture" className="hover:text-zinc-300 transition-colors">Categories</Link></li>
                  <li><Link href="/wiki/builders/google" className="hover:text-zinc-300 transition-colors">Builders</Link></li>
                  <li><Link href="/wiki/skills/observability-monitoring" className="hover:text-zinc-300 transition-colors">Skills</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-zinc-300 font-medium mb-2">About</h4>
                <ul className="space-y-1.5">
                  <li><span className="text-zinc-600">Built by perditioinc</span></li>
                  <li><span className="text-zinc-600">{data?.repos.length ?? 0} repos indexed</span></li>
                  <li><span className="text-zinc-600">Next.js + FastAPI</span></li>
                </ul>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-800/50 flex items-center justify-between">
              <span className="text-[10px] text-zinc-600">Reporium — AI Dev Tool Library</span>
              <span className="text-[10px] text-zinc-700">{new Date().getFullYear()}</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
