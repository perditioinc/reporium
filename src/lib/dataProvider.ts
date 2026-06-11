/**
 * Data provider abstraction.
 * Lite mode: reads from /data/library.json
 * Production mode: reads from NEXT_PUBLIC_REPORIUM_API_URL
 * Falls back to JSON if API is unreachable.
 */

import type {
  LibraryData,
  LibraryStats,
  EnrichedRepo,
  TrendData,
  GapAnalysis,
  PortfolioInsights,
  TaxonomyValueOption,
  CrossDimensionAnalytics,
  SimilarRepo,
  TagMetrics,
  Category,
  BuilderStats,
  SkillStats,
} from '@/types/repo'

export type DataMode = 'lite' | 'production'
export type SearchMode = 'keyword' | 'semantic'

export interface LoadProgress {
  stage: 'connecting' | 'repos' | 'trends' | 'taxonomy' | 'ready' | 'error'
  /** 0-100 within the current stage */
  percent: number
  /** e.g. "Loading repos (500/1400)" */
  detail: string
}

/**
 * KAN-152: lean repo projection returned by `GET /library/preview`.
 *
 * Strict subset of {@link EnrichedRepo} containing only the fields the
 * `RepoCardMinimal` grid renders above the fold. Aggregates (commitStats,
 * taxonomy, parentStats, builders, forkSync, etc.) are intentionally omitted
 * so the home payload drops from ~5.2 MB to ~0.4 MB.
 *
 * Note: `stars` and `forks` are pre-coalesced server-side via
 * `COALESCE(parent_stars, stargazers_count, 0)` — clients should NOT need
 * `parentStats?.stars` fallback when consuming preview data.
 *
 * KAN-185: optional fields are surfaced when the caller asks for them via
 * `getPreview(limit, { include: ['stats', 'parent', 'quality'] })`. The
 * server projection (KAN-179) attaches each block independently — `stats`
 * adds `commitStats`, `parent` adds `parentStats` + `upstreamCreatedAt`,
 * `quality` adds `qualitySignals`. Consumers MUST treat each as optional.
 */
export interface PreviewRepo {
  id: string
  name: string
  fullName: string
  description: string | null
  isFork: boolean
  forkedFrom: string | null
  language: string | null
  stars: number
  forks: number
  lastUpdated: string | null
  primaryCategory: string | null
  dbCategory: string | null
  enrichedTags: string[]
  isArchived: boolean
  url: string
  /** KAN-185 / KAN-179: present when `?include=stats` is passed. */
  commitStats?: { last7Days: number; last30Days: number; last90Days: number }
  /** KAN-185 / KAN-179: present when `?include=parent` is passed. */
  parentStats?: {
    owner: string
    repo: string
    stars: number
    forks: number
    isArchived: boolean
    lastCommitDate: string | null
    description: string | null
    url: string
  }
  /** KAN-185 / KAN-179: present when `?include=parent` is passed. */
  upstreamCreatedAt?: string | null
  /** KAN-185 / KAN-179: present when `?include=quality` is passed. */
  qualitySignals?: Record<string, unknown>
}

/** KAN-185: opt-in field-set tokens for `GET /library/preview?include=`. */
export type PreviewIncludeToken = 'stats' | 'parent' | 'quality'

/** KAN-185: options accepted by `getPreview()`. */
export interface GetPreviewOptions {
  include?: PreviewIncludeToken[]
}

/** KAN-152: response shape for `GET /library/preview`. */
export interface PreviewData {
  generatedAt: string
  totalRepos: number
  limit: number
  sort: 'stars' | 'updated' | 'activity'
  category: string | null
  repos: PreviewRepo[]
}

/**
 * KAN-189: response shape for `GET /library/aggregates` (KAN-188 backend, PR
 * #476 squash `7aadbbb`). Carries the aggregate computations that
 * `LibraryData` exposed alongside the `repos` array, without the array — so
 * the home/insights/trends pages can light up `StatsBar`, `MetricsSidebar`,
 * `LibraryInsightsWidget`, `CrossDimensionWidget`, `RecommendationsWidget`
 * before the full ~5 MB `/library/full` ladder lands.
 *
 * The endpoint is unauthenticated and CDN-cached `public, s-maxage=300,
 * stale-while-revalidate=60`. Payload is ~3.8 MB at default (driven mostly
 * by the ~5300-row `tagMetrics` array). Drops to a single canonical shape;
 * unlike `/library/preview` there are no `?include=` toggles.
 */
export interface AggregatesData {
  generatedAt: string
  totalRepos: number
  stats: LibraryStats
  gapAnalysis: GapAnalysis
  tagMetrics: TagMetrics[]
  categories: Category[]
  builderStats: BuilderStats[]
  aiDevSkillStats: SkillStats[]
  pmSkillStats: SkillStats[]
}

export interface DataProvider {
  mode: DataMode
  getOwnedLibrary(): Promise<LibraryData | null>
  /**
   * KAN-152: lightweight projected library for first paint.
   * Returns ~563 B/repo vs ~3 KB/repo from `getLibrary()`. Defaults to top 300
   * repos sorted by stars. Falls back to a `LibraryData`-shaped synthesis
   * (via `getOwnedLibrary()` + first page of `getLibrary()`) when the API is
   * unavailable so callers never see a hard failure.
   *
   * KAN-185: pass `{ include: [...] }` to opt into KAN-179's optional field
   * blocks (`stats` -> commitStats, `parent` -> parentStats + upstreamCreatedAt,
   * `quality` -> qualitySignals). Cache key is keyed on the include set, so
   * a baseline preview and an enriched preview can co-exist in the same SPA
   * session without clobbering each other.
   */
  getPreview(limit?: number, options?: GetPreviewOptions): Promise<PreviewData>
  /**
   * KAN-189: lightweight aggregate-only payload for first-paint of widgets
   * that read `tagMetrics` / `gapAnalysis` / `builderStats` / `aiDevSkillStats`
   * / `pmSkillStats` / `categories`. Eagerly fetched between Stage 2 (preview
   * cards) and Stage 3 (full library lazy load) so `StatsBar`, `MetricsSidebar`,
   * `LibraryInsightsWidget`, `CrossDimensionWidget`, `RecommendationsWidget`
   * light up before any user interaction triggers `getLibrary()`.
   *
   * Single canonical shape — no params, single in-memory cache slot. Falls
   * back to a `JsonDataProvider`-derived synthesis on API failure so widgets
   * never see a hard error.
   */
  getAggregates(): Promise<AggregatesData>
  getLibrary(onProgress?: (p: LoadProgress) => void): Promise<LibraryData>
  getDegradedState(): boolean
  clearDegradedState(): void
  getTrends(): Promise<TrendData | null>
  getGaps(): Promise<GapAnalysis | null>
  getRepo(name: string): Promise<EnrichedRepo | null>
  searchRepos(query: string, mode?: SearchMode): Promise<EnrichedRepo[]>
  getTaxonomyValues(dimension: string): Promise<TaxonomyValueOption[]>
  getPortfolioInsights(): Promise<PortfolioInsights | null>
  getCrossDimensionAnalytics(dim1: string, dim2: string, limit?: number): Promise<CrossDimensionAnalytics | null>
  getSimilarRepos(name: string, limit?: number): Promise<SimilarRepo[]>
}

export function createDataProvider(): DataProvider {
  const apiUrl = process.env.NEXT_PUBLIC_REPORIUM_API_URL
  if (apiUrl) return new ApiDataProvider(apiUrl)
  return new JsonDataProvider()
}

class JsonDataProvider implements DataProvider {
  mode: DataMode = 'lite'
  private libraryCache: LibraryData | null = null

  getDegradedState(): boolean {
    return false
  }

  clearDegradedState(): void {
    // no-op: JsonDataProvider is never degraded relative to itself
  }

  private estimateActivityScore(repo: EnrichedRepo): number {
    const last7 = repo.commitStats?.last7Days ?? 0
    const last30 = repo.commitStats?.last30Days ?? 0
    const last90 = repo.commitStats?.last90Days ?? 0
    const weighted = Math.min(last7 * 12 + last30 * 2 + last90, 100)
    return Math.round(weighted)
  }

  private async readJsonFromDisk<T>(filename: string): Promise<T | null> {
    try {
      const importNode = new Function('specifier', 'return import(specifier)') as <TModule>(specifier: string) => Promise<TModule>
      const fs = await importNode<typeof import('node:fs')>('node:fs')
      const path = await importNode<typeof import('node:path')>('node:path')
      const filePath = path.join(process.cwd(), 'data', filename)
      if (!fs.existsSync(filePath)) return null
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
    } catch {
      return null
    }
  }

  async getOwnedLibrary(): Promise<LibraryData | null> {
    if (typeof window === 'undefined') {
      return this.readJsonFromDisk<LibraryData>('owned.json')
    }
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const res = await fetch(`${basePath}/data/owned.json`)
      if (!res.ok) return null
      return res.json()
    } catch { return null }
  }

  /**
   * KAN-152: synthesise a `PreviewData` from the static library JSON when
   * running in lite/JSON mode. The home page treats preview as the primary
   * first-paint shape; without this fallback, a JSON-only build would crash
   * before the lazy `getLibrary()` ever fires.
   *
   * KAN-185: when `options.include` requests a block, surface that block from
   * the in-memory `EnrichedRepo` so /insights and /trends keep working under
   * lite-mode (jest, JSON-only builds) without requiring the API.
   */
  async getPreview(limit = 300, options?: GetPreviewOptions): Promise<PreviewData> {
    const lib = await this.getLibrary()
    const sorted = [...lib.repos].sort(
      (a, b) => (b.parentStats?.stars ?? b.stars ?? 0) - (a.parentStats?.stars ?? a.stars ?? 0),
    )
    const wantStats = options?.include?.includes('stats') ?? false
    const wantParent = options?.include?.includes('parent') ?? false
    const wantQuality = options?.include?.includes('quality') ?? false
    const repos: PreviewRepo[] = sorted.slice(0, limit).map((r) => {
      const base: PreviewRepo = {
        id: String(r.id),
        name: r.name,
        fullName: r.fullName,
        description: r.description,
        isFork: r.isFork,
        forkedFrom: r.forkedFrom,
        language: r.language,
        stars: r.parentStats?.stars ?? r.stars ?? 0,
        forks: r.parentStats?.forks ?? r.forks ?? 0,
        lastUpdated: r.lastUpdated,
        primaryCategory: r.primaryCategory ?? null,
        dbCategory: r.dbCategory ?? null,
        enrichedTags: r.enrichedTags ?? [],
        isArchived: r.isArchived,
        url: r.url,
      }
      if (wantStats && r.commitStats) {
        base.commitStats = {
          last7Days: r.commitStats.last7Days ?? 0,
          last30Days: r.commitStats.last30Days ?? 0,
          last90Days: r.commitStats.last90Days ?? 0,
        }
      }
      if (wantParent) {
        if (r.parentStats) {
          base.parentStats = {
            owner: r.parentStats.owner,
            repo: r.parentStats.repo,
            stars: r.parentStats.stars,
            forks: r.parentStats.forks,
            isArchived: r.parentStats.isArchived,
            lastCommitDate: r.parentStats.lastCommitDate ?? null,
            description: r.parentStats.description,
            url: r.parentStats.url,
          }
        }
        base.upstreamCreatedAt = r.upstreamCreatedAt ?? null
      }
      if (wantQuality && r.qualitySignals) {
        base.qualitySignals = r.qualitySignals as Record<string, unknown>
      }
      return base
    })
    return {
      generatedAt: lib.generatedAt,
      totalRepos: lib.repos.length,
      limit,
      sort: 'stars',
      category: null,
      repos,
    }
  }

  async getLibrary(_onProgress?: (p: LoadProgress) => void): Promise<LibraryData> {
    if (this.libraryCache) return this.libraryCache
    if (typeof window === 'undefined') {
      const data = await this.readJsonFromDisk<LibraryData>('library.json')
      if (!data) throw new Error('Library data not found on disk. Run npm run generate.')
      this.libraryCache = data
      return data
    }
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
    const res = await fetch(`${basePath}/data/library.json`)
    if (!res.ok) throw new Error('Library data not found. Run npm run generate to generate it.')
    const data: LibraryData = await res.json()
    this.libraryCache = data
    return data
  }

  /**
   * KAN-189: synthesise an `AggregatesData` from the static library JSON when
   * running in lite/JSON mode. The aggregate widgets treat aggregates as the
   * primary first-paint shape; without this fallback, jest tests + JSON-only
   * builds would crash before the lazy `getLibrary()` ever fires.
   */
  async getAggregates(): Promise<AggregatesData> {
    const lib = await this.getLibrary()
    return {
      generatedAt: lib.generatedAt,
      totalRepos: lib.totalRepos ?? lib.repos.length,
      stats: lib.stats,
      gapAnalysis: lib.gapAnalysis,
      tagMetrics: lib.tagMetrics,
      categories: lib.categories,
      builderStats: lib.builderStats,
      aiDevSkillStats: lib.aiDevSkillStats,
      pmSkillStats: lib.pmSkillStats,
    }
  }

  async getTrends(): Promise<TrendData | null> {
    if (typeof window === 'undefined') {
      return this.readJsonFromDisk<TrendData>('trends.json')
    }
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const res = await fetch(`${basePath}/data/trends.json`)
      if (!res.ok) return null
      return res.json()
    } catch { return null }
  }

  async getGaps(): Promise<GapAnalysis | null> {
    if (typeof window === 'undefined') {
      return this.readJsonFromDisk<GapAnalysis>('gaps.json')
    }
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const res = await fetch(`${basePath}/data/gaps.json`)
      if (!res.ok) return null
      return res.json()
    } catch { return null }
  }

  async getRepo(name: string): Promise<EnrichedRepo | null> {
    const library = await this.getLibrary()
    return library.repos.find(r => r.name === name) ?? null
  }

  async searchRepos(query: string): Promise<EnrichedRepo[]> {
    const library = await this.getLibrary()
    const q = query.toLowerCase()
    return library.repos.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.enrichedTags.some(t => t.toLowerCase().includes(q))
    )
  }

  async getTaxonomyValues(dimension: string): Promise<TaxonomyValueOption[]> {
    const library = await this.getLibrary()
    const counts = new Map<string, number>()
    for (const repo of library.repos) {
      for (const entry of repo.taxonomy ?? []) {
        if (entry.dimension !== dimension) continue
        counts.set(entry.value, (counts.get(entry.value) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, repo_count], index) => ({
        id: index + 1,
        dimension,
        name,
        repo_count,
      }))
  }

  async getPortfolioInsights(): Promise<PortfolioInsights | null> {
    const library = await this.getLibrary()
    const taxonomyCounts = new Map<string, { dimension: string; count: number }>()
    for (const repo of library.repos) {
      for (const entry of repo.taxonomy ?? []) {
        const key = `${entry.dimension}:${entry.value}`
        const current = taxonomyCounts.get(key)
        taxonomyCounts.set(key, {
          dimension: entry.dimension,
          count: (current?.count ?? 0) + 1,
        })
      }
    }

    const taxonomyGaps = [...taxonomyCounts.entries()]
      .filter(([, value]) => value.dimension !== 'skill_area' && value.count <= 3)
      .sort((a, b) => a[1].count - b[1].count || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([key, value]) => ({
        dimension: value.dimension,
        value: key.split(':').slice(1).join(':'),
        repo_count: value.count,
        trending_score: 0,
      }))

    const staleRepos = [...library.repos]
      .map((repo) => ({
        repo_name: repo.name,
        // For forks, show the upstream owner so the display reads "ggml-org/llama.cpp"
        // rather than the fork owner ("perditioinc/llama.cpp").
        owner: (repo.isFork && repo.parentStats?.owner) ? repo.parentStats.owner : (repo.fullName.split('/')[0] ?? ''),
        github_url: (repo.isFork && repo.parentStats?.url) ? repo.parentStats.url : repo.url,
        parent_stars: repo.parentStats?.stars ?? repo.stars,
        activity_score: this.estimateActivityScore(repo),
        last_updated_at: repo.lastUpdated,
        stale_days: Math.floor((Date.now() - new Date(repo.lastUpdated).getTime()) / 86400000),
      }))
      .filter((repo) => repo.stale_days >= 180)
      .sort((a, b) => b.stale_days - a.stale_days)
      .slice(0, 5)

    const velocityLeaders = [...library.repos]
      .map((repo) => ({
        repo_name: repo.name,
        // For forks, show the upstream owner so the display reads "ggml-org/llama.cpp"
        // rather than the fork owner ("perditioinc/llama.cpp").
        owner: (repo.isFork && repo.parentStats?.owner) ? repo.parentStats.owner : (repo.fullName.split('/')[0] ?? ''),
        github_url: (repo.isFork && repo.parentStats?.url) ? repo.parentStats.url : repo.url,
        commits_last_7_days: repo.commitStats?.last7Days ?? 0,
        commits_last_30_days: repo.commitStats?.last30Days ?? 0,
        activity_score: this.estimateActivityScore(repo),
      }))
      .filter((repo) => repo.commits_last_30_days > 0)
      .sort((a, b) => b.commits_last_30_days - a.commits_last_30_days || b.commits_last_7_days - a.commits_last_7_days)
      .slice(0, 5)

    return {
      generated_at: new Date().toISOString(),
      taxonomy_gaps: taxonomyGaps,
      stale_repos: staleRepos,
      velocity_leaders: velocityLeaders,
      near_duplicate_clusters: [],
      summary: [
        taxonomyGaps[0] ? `${taxonomyGaps[0].value} is underrepresented in the current taxonomy coverage.` : '',
        staleRepos[0] ? `${staleRepos[0].owner}/${staleRepos[0].repo_name} is the stalest repo in the fallback dataset.` : '',
        velocityLeaders[0] ? `${velocityLeaders[0].owner}/${velocityLeaders[0].repo_name} is leading recent commit velocity.` : '',
      ].filter(Boolean),
    }
  }

  async getCrossDimensionAnalytics(dim1: string, dim2: string, limit = 10): Promise<CrossDimensionAnalytics | null> {
    const library = await this.getLibrary()
    const counts = new Map<string, number>()

    for (const repo of library.repos) {
      const dim1Values = [...new Set((repo.taxonomy ?? []).filter((entry) => entry.dimension === dim1).map((entry) => entry.value))]
      const dim2Values = [...new Set((repo.taxonomy ?? []).filter((entry) => entry.dimension === dim2).map((entry) => entry.value))]
      for (const left of dim1Values) {
        for (const right of dim2Values) {
          const key = `${left}|||${right}`
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      }
    }

    return {
      dim1,
      dim2,
      limit,
      pairs: [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([key, repo_count]) => {
          const [dim1_value, dim2_value] = key.split('|||')
          return { dim1_value, dim2_value, repo_count }
        }),
    }
  }

  async getSimilarRepos(_name: string, _limit = 5): Promise<SimilarRepo[]> {
    return []
  }
}

class ApiDataProvider implements DataProvider {
  mode: DataMode = 'production'
  private apiUrl: string
  private fallback: JsonDataProvider
  private degraded = false
  /** In-memory cache so subsequent getLibrary() calls don't re-fetch */
  private libraryCache: LibraryData | null = null
  private libraryPromise: Promise<LibraryData> | null = null

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl.replace(/\/$/, '')
    this.fallback = new JsonDataProvider()
  }

  /**
   * Build request headers. Auth-hardening PR #5: the `X-App-Token` branch is
   * gone — the browser never holds the app token anymore. Token-gated
   * endpoints (/intelligence/ask, /ask/stream, /nl-filter) are reached via
   * the same-origin proxy routes under /api/intelligence/*, which attach the
   * server-held REPORIUM_APP_TOKEN. If a direct endpoint here 403s, callers
   * fall through to the JSON fallback path as before.
   */
  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      'Accept': 'application/json',
      ...(extra ?? {}),
    }
  }

  private async apiFetch<T>(path: string, timeoutMs?: number): Promise<T> {
    const isBuildTime = typeof window === 'undefined' && process.env.NEXT_PHASE === 'phase-production-build'
    const effectiveTimeout = timeoutMs ?? (isBuildTime ? 8_000 : 30_000)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), effectiveTimeout)
    try {
      const res = await fetch(`${this.apiUrl}${path}`, {
        headers: this.buildHeaders(),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      return res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  private async apiPost<T, B>(path: string, body: B, timeoutMs = 30_000): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${this.apiUrl}${path}`, {
        method: 'POST',
        headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      return res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Shared page-1 (page_size=500) promise.
   *
   * getOwnedLibrary() starts this request for the Stage-1 preview.
   * _fetchLibrary() awaits the same promise — so page 1 is never fetched twice.
   * Net result: 5 /library/full requests → 4 (one page-1 + three pages 2-4).
   */
  private readonly PAGE_SIZE = 500
  private page1Promise: Promise<LibraryData & { totalPages?: number; totalRepos?: number }> | null = null

  /** Returns (and memoises) the page-1 request at page_size=500. */
  private getPage1(): Promise<LibraryData & { totalPages?: number; totalRepos?: number }> {
    if (!this.page1Promise) {
      this.page1Promise = this.apiFetch<LibraryData & { totalPages?: number; totalRepos?: number }>(
        `/library/full?page=1&page_size=${this.PAGE_SIZE}`
      ).catch(err => {
        this.page1Promise = null;  // reset on failure so retries are not sticky
        throw err;
      });
    }
    return this.page1Promise
  }

  async getOwnedLibrary(): Promise<LibraryData | null> {
    // Show a first useful grid from the static owned artifact before waiting on
    // the much heavier `/library/full?page_size=500` API call. This makes launch
    // feel alive even when Cloud Run is cold.
    const staticOwned = await this.fallback.getOwnedLibrary()
    if (staticOwned?.repos?.length) return staticOwned

    // Last-resort preview if the static artifact is unavailable.
    try {
      return await this.apiFetch<LibraryData & { totalPages?: number; totalRepos?: number }>(
        '/library/full?page=1&page_size=24',
        8_000
      )
    } catch {
      // API unavailable: skip preview; getLibrary() fallback handles it.
      return null
    }
  }

  /**
   * KAN-152: lean preview cache — `/library/preview?limit=N` returns a
   * projected ~1.5 KB-per-repo payload that the home grid renders before any
   * `/library/full` call. Endpoint shipped via KAN-151 (PR #461 @ 8634aa10).
   *
   * Cached in-memory for the session; on API failure we fall back to the
   * `JsonDataProvider` synthesis so the home page never loses its first
   * paint to a transient outage.
   *
   * KAN-185: opt-in field blocks via `/library/preview?include=stats,parent,quality`
   * (server: KAN-179, PR #472 @ 60e751e). Per-include cache keys keep the home
   * baseline (~165 KB / no include tokens) and the enriched insights/trends
   * payload (~500 KB / 3 tokens) co-resident in the same SPA session.
   */
  private previewCache: Map<string, PreviewData> = new Map()
  private previewPromises: Map<string, Promise<PreviewData>> = new Map()
  async getPreview(limit = 300, options?: GetPreviewOptions): Promise<PreviewData> {
    const includeSorted = [...(options?.include ?? [])].sort()
    const cacheKey = `preview:${limit}:${includeSorted.join(',') || 'none'}`
    const cached = this.previewCache.get(cacheKey)
    if (cached) return cached
    const inflight = this.previewPromises.get(cacheKey)
    if (inflight) return inflight
    const includeParam = includeSorted.length ? `&include=${includeSorted.join(',')}` : ''
    const promise = (async () => {
      try {
        const data = await this.apiFetch<PreviewData>(`/library/preview?limit=${limit}${includeParam}`)
        this.previewCache.set(cacheKey, data)
        return data
      } catch {
        // API unavailable — synthesise from the bundled library JSON so the
        // home page still renders. Mark degraded so the banner appears.
        this.degraded = true
        const fallback = await this.fallback.getPreview(limit, options)
        this.previewCache.set(cacheKey, fallback)
        return fallback
      } finally {
        this.previewPromises.delete(cacheKey)
      }
    })()
    this.previewPromises.set(cacheKey, promise)
    return promise
  }

  /**
   * KAN-189: aggregate cache — `/library/aggregates` (KAN-188, PR #476 squash
   * `7aadbbb`) returns the ~3.8 MB aggregate-only payload that the home /
   * insights / trends pages render before any `/library/full` call. Single
   * canonical shape, single cache slot, single in-flight promise — no params.
   *
   * On API failure we fall back to the `JsonDataProvider` synthesis so the
   * aggregate widgets never lose their first paint to a transient outage.
   * Marks degraded so the "Live data is unavailable" banner appears.
   */
  private aggregatesCache: AggregatesData | null = null
  private aggregatesPromise: Promise<AggregatesData> | null = null
  async getAggregates(): Promise<AggregatesData> {
    if (this.aggregatesCache) return this.aggregatesCache
    if (this.aggregatesPromise) return this.aggregatesPromise
    const promise = (async () => {
      try {
        const data = await this.apiFetch<AggregatesData>('/library/aggregates')
        this.aggregatesCache = data
        return data
      } catch {
        this.degraded = true
        const fallback = await this.fallback.getAggregates()
        this.aggregatesCache = fallback
        return fallback
      } finally {
        this.aggregatesPromise = null
      }
    })()
    this.aggregatesPromise = promise
    return promise
  }

  getDegradedState(): boolean {
    return this.degraded
  }

  clearDegradedState(): void {
    // Reset the degraded flag so the "Live data is unavailable" banner does not
    // re-appear after the user dismisses it and then navigates within the SPA.
    // Without this, `this.degraded` latches true until _fetchLibrary() runs
    // again — which is skipped whenever libraryCache is populated.
    this.degraded = false
  }

  async getLibrary(onProgress?: (p: LoadProgress) => void): Promise<LibraryData> {
    // Deduplicate concurrent calls — only one in-flight request at a time.
    if (this.libraryCache) return this.libraryCache
    if (this.libraryPromise) return this.libraryPromise
    this.libraryPromise = this._fetchLibrary(onProgress).finally(() => {
      this.libraryPromise = null
    })
    return this.libraryPromise
  }

  private async _fetchLibrary(onProgress?: (p: LoadProgress) => void): Promise<LibraryData> {
    const report = onProgress ?? (() => {})
    try {
      this.degraded = false
      report({ stage: 'connecting', percent: 0, detail: 'Connecting to API…' })

      // Reuse the page-1 promise started by getOwnedLibrary() (or start it here
      // if getOwnedLibrary() was never called) — no duplicate network request.
      const page1 = await this.getPage1()
      const totalPages = page1.totalPages ?? 1
      const totalRepos = page1.totalRepos ?? page1.repos.length

      if (totalPages <= 1) {
        report({ stage: 'repos', percent: 100, detail: `Loaded ${totalRepos} repos` })
        this.libraryCache = page1
        return page1
      }

      // Track progress as each page resolves
      let loaded = page1.repos.length
      report({ stage: 'repos', percent: Math.round((loaded / totalRepos) * 100), detail: `Loading repos (${loaded}/${totalRepos})…` })

      const pages: LibraryData[] = []
      const remaining = Array.from({ length: totalPages - 1 }, (_, i) =>
        this.apiFetch<LibraryData>(`/library/full?page=${i + 2}&page_size=${this.PAGE_SIZE}`).then(page => {
          loaded += page.repos.length
          report({ stage: 'repos', percent: Math.min(Math.round((loaded / totalRepos) * 100), 100), detail: `Loading repos (${loaded}/${totalRepos})…` })
          pages.push(page)
          return page
        })
      )
      await Promise.all(remaining)
      const allRepos = pages.reduce((acc, p) => acc.concat(p.repos), page1.repos)
      report({ stage: 'repos', percent: 100, detail: `Loaded ${allRepos.length} repos` })
      const result = { ...page1, repos: allRepos }
      this.libraryCache = result
      return result
    } catch {
      this.degraded = true
      report({ stage: 'error', percent: 0, detail: 'API unavailable — using cached data' })
      console.warn('API unreachable, falling back to JSON')
      return this.fallback.getLibrary()
    }
  }

  async getTrends(): Promise<TrendData | null> {
    try {
      return await this.apiFetch<TrendData>('/trends/report')
    } catch { return this.fallback.getTrends() }
  }

  async getGaps(): Promise<GapAnalysis | null> {
    try { return await this.apiFetch<GapAnalysis>('/gaps') }
    catch { return this.fallback.getGaps() }
  }

  async getRepo(name: string): Promise<EnrichedRepo | null> {
    try { return await this.apiFetch<EnrichedRepo>(`/repos/${name}`) }
    catch { return this.fallback.getRepo(name) }
  }

  async searchRepos(query: string, mode: SearchMode = 'keyword'): Promise<EnrichedRepo[]> {
    try {
      const path = mode === 'semantic'
        ? `/search/semantic?q=${encodeURIComponent(query)}`
        : `/search?q=${encodeURIComponent(query)}`
      return await this.apiFetch<EnrichedRepo[]>(path)
    }
    catch { return this.fallback.searchRepos(query) }
  }

  async getTaxonomyValues(dimension: string): Promise<TaxonomyValueOption[]> {
    try {
      const response = await this.apiFetch<{ values: TaxonomyValueOption[] }>(`/taxonomy/${encodeURIComponent(dimension)}`)
      const values = response.values ?? []
      // The taxonomy_values table has never been populated for tags or categories —
      // the 6 AI dimensions (modality, use_case, etc.) exist but tags/categories rows
      // are missing. Derive them from the in-memory library when the endpoint returns empty.
      if (values.length === 0 && (dimension === 'tags' || dimension === 'categories')) {
        return this._deriveTagsOrCategories(dimension)
      }
      return values
    } catch {
      return this.fallback.getTaxonomyValues(dimension)
    }
  }

  /** Derive tag or category counts from the in-memory library cache. */
  private async _deriveTagsOrCategories(dimension: string): Promise<TaxonomyValueOption[]> {
    const library = await this.getLibrary()
    const counts = new Map<string, number>()
    for (const repo of library.repos) {
      if (dimension === 'tags') {
        for (const tag of repo.enrichedTags ?? []) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1)
        }
      } else {
        // categories: use allCategories array (string names), falling back to dbCategory
        const cats: string[] = repo.allCategories?.length
          ? repo.allCategories
          : repo.dbCategory
            ? [repo.dbCategory]
            : []
        for (const cat of cats) {
          counts.set(cat, (counts.get(cat) ?? 0) + 1)
        }
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 500)
      .map(([name, repo_count], index) => ({
        id: index + 1,
        dimension,
        name,
        repo_count,
      }))
  }

  async getPortfolioInsights(): Promise<PortfolioInsights | null> {
    try {
      return await this.apiFetch<PortfolioInsights>('/intelligence/portfolio-insights')
    } catch {
      return this.fallback.getPortfolioInsights()
    }
  }

  async getCrossDimensionAnalytics(dim1: string, dim2: string, limit = 10): Promise<CrossDimensionAnalytics | null> {
    try {
      return await this.apiFetch<CrossDimensionAnalytics>(
        `/analytics/cross-dimension?dim1=${encodeURIComponent(dim1)}&dim2=${encodeURIComponent(dim2)}&limit=${limit}`
      )
    } catch {
      return this.fallback.getCrossDimensionAnalytics(dim1, dim2, limit)
    }
  }

  async getSimilarRepos(name: string, limit = 5): Promise<SimilarRepo[]> {
    try {
      // API exposes `/intelligence/similar/{name}` returning { source_repo, similar, total }.
      // The legacy `/repos/{name}/similar` path no longer exists. Unwrap `.similar`
      // to preserve the raw-array contract existing call sites rely on.
      const data = await this.apiFetch<{ similar?: SimilarRepo[] } | SimilarRepo[]>(
        `/intelligence/similar/${encodeURIComponent(name)}?limit=${limit}`
      )
      if (Array.isArray(data)) return data
      return (data as { similar?: SimilarRepo[] }).similar ?? []
    } catch {
      return this.fallback.getSimilarRepos(name, limit)
    }
  }

  async getIntelligenceSimilar(name: string, limit = 8): Promise<SimilarRepo[]> {
    try {
      const data = await this.apiFetch<{ similar?: SimilarRepo[] } | SimilarRepo[]>(
        `/intelligence/similar/${encodeURIComponent(name)}?limit=${limit}`
      )
      if (Array.isArray(data)) return data
      return (data as { similar?: SimilarRepo[] }).similar ?? []
    } catch {
      return []
    }
  }

  async getTaxonomyAllValues(limit = 500): Promise<{ dimension: string; value: string; repo_count?: number; count?: number }[]> {
    try {
      const data = await this.apiFetch<{ values?: unknown[] } | unknown[]>(`/taxonomy/values?limit=${limit}`)
      if (Array.isArray(data)) return data as { dimension: string; value: string; repo_count?: number; count?: number }[]
      const typed = data as { values?: unknown[] }
      if (Array.isArray(typed.values)) return typed.values as { dimension: string; value: string; repo_count?: number; count?: number }[]
      return []
    } catch {
      return []
    }
  }

  /**
   * Fetch values per-dimension in parallel, then flatten to the `{dimension, value, repo_count}`
   * shape expected by the taxonomy explorer. Avoids the global-top-N cap of `/taxonomy/values`
   * which lets a single high-cardinality dimension starve all others.
   */
  async getTaxonomyValuesByDimensions(
    dimensions: readonly string[],
    perDimensionLimit = 100,
  ): Promise<{ dimension: string; value: string; repo_count?: number; count?: number }[]> {
    const results = await Promise.all(
      dimensions.map(async (dim) => {
        try {
          const values = await this.getTaxonomyValues(dim)
          return values.slice(0, perDimensionLimit).map((v) => ({
            dimension: dim,
            value: v.name,
            repo_count: v.repo_count,
          }))
        } catch {
          return []
        }
      })
    )
    return results.flat()
  }

  async getGapTaxonomy(minRepos = 1): Promise<{ dimension: string; value: string; repo_count: number; gap_score?: number }[]> {
    try {
      const data = await this.apiFetch<{ gaps?: unknown[] }>(`/gaps/taxonomy?min_repos=${minRepos}`)
      return (data.gaps ?? []) as { dimension: string; value: string; repo_count: number; gap_score?: number }[]
    } catch {
      return []
    }
  }

  async getRepoEvaluation(name: string): Promise<{
    pros: string[]; cons: string[]; best_for: string; avoid_if: string;
    comparable_to: string[]; community_verdict: string;
  } | null> {
    try {
      const data = await this.apiFetch<{ evaluation?: unknown }>(`/repos/${encodeURIComponent(name)}/evaluation`)
      return (data?.evaluation ?? null) as {
        pros: string[]; cons: string[]; best_for: string; avoid_if: string;
        comparable_to: string[]; community_verdict: string;
      } | null
    } catch {
      return null
    }
  }

  /**
   * Client-only. Auth-hardening PR #5: asks go through the same-origin proxy
   * (/api/intelligence/ask) instead of hitting reporium-api directly with a
   * browser-held token. The route handler attaches the server-held
   * REPORIUM_APP_TOKEN. Not available on the github-pages static export
   * (ADR-005) — callers gate on REPORIUM_DEPLOY_TARGET before invoking.
   */
  async askQuestion(question: string, options?: { top_k?: number; session_id?: string }): Promise<{
    answer: string; sources: unknown[]; question: string; model: string;
    answered_at: string; embedding_candidates: number;
    tokens_used: { input: number; output: number; total: number };
  }> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    try {
      const res = await fetch('/api/intelligence/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question,
          top_k: options?.top_k ?? 8,
          ...(options?.session_id ? { session_id: options.session_id } : {}),
        }),
        signal: controller.signal,
      })
      if (res.status === 429) throw new Error('rate limit exceeded')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const detail = (body as { detail?: string })?.detail
        throw new Error(detail ? `server:${detail}` : `API error: ${res.status}`)
      }
      return res.json()
    } finally {
      clearTimeout(timer)
    }
  }
}
