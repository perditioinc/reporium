/**
 * Data provider abstraction.
 * Lite mode: reads from /data/library.json
 * Production mode: reads from NEXT_PUBLIC_REPORIUM_API_URL
 * Falls back to JSON if API is unreachable.
 */

import type { LibraryData, EnrichedRepo, TrendData, GapAnalysis, PortfolioInsights, TaxonomyValueOption, CrossDimensionAnalytics, SimilarRepo } from '@/types/repo'

export type DataMode = 'lite' | 'production'
export type SearchMode = 'keyword' | 'semantic'

export interface DataProvider {
  mode: DataMode
  getOwnedLibrary(): Promise<LibraryData | null>
  getLibrary(): Promise<LibraryData>
  getDegradedState(): boolean
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

  getDegradedState(): boolean {
    return false
  }

  private estimateActivityScore(repo: EnrichedRepo): number {
    const last7 = repo.commitStats?.last7Days ?? 0
    const last30 = repo.commitStats?.last30Days ?? 0
    const last90 = repo.commitStats?.last90Days ?? 0
    const weighted = Math.min(last7 * 12 + last30 * 2 + last90, 100)
    return Math.round(weighted)
  }

  async getOwnedLibrary(): Promise<LibraryData | null> {
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const res = await fetch(`${basePath}/data/owned.json`)
      if (!res.ok) return null
      return res.json()
    } catch { return null }
  }

  async getLibrary(): Promise<LibraryData> {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
    const res = await fetch(`${basePath}/data/library.json`)
    if (!res.ok) throw new Error('Library data not found. Run npm run generate to generate it.')
    return res.json()
  }

  async getTrends(): Promise<TrendData | null> {
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const res = await fetch(`${basePath}/data/trends.json`)
      if (!res.ok) return null
      return res.json()
    } catch { return null }
  }

  async getGaps(): Promise<GapAnalysis | null> {
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

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl.replace(/\/$/, '')
    this.fallback = new JsonDataProvider()
  }

  private async apiFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  }

  async getOwnedLibrary(): Promise<LibraryData | null> {
    return this.fallback.getOwnedLibrary()
  }

  getDegradedState(): boolean {
    return this.degraded
  }

  async getLibrary(): Promise<LibraryData> {
    try {
      this.degraded = false
      const PAGE_SIZE = 500
      // Fetch page 1 to get totalPages + corpus aggregates
      const page1 = await this.apiFetch<LibraryData & { totalPages?: number; totalRepos?: number }>(`/library/full?page=1&pageSize=${PAGE_SIZE}`)
      const totalPages = page1.totalPages ?? 1
      if (totalPages <= 1) return page1

      // Fetch remaining pages in parallel (cap at reasonable limit)
      const remaining = Array.from({ length: totalPages - 1 }, (_, i) =>
        this.apiFetch<LibraryData>(`/library/full?page=${i + 2}&pageSize=${PAGE_SIZE}`)
      )
      const pages = await Promise.all(remaining)
      const allRepos = pages.reduce((acc, p) => acc.concat(p.repos), page1.repos)
      return { ...page1, repos: allRepos }
    } catch {
      this.degraded = true
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
      return response.values ?? []
    } catch {
      return this.fallback.getTaxonomyValues(dimension)
    }
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
      return await this.apiFetch<SimilarRepo[]>(`/repos/${encodeURIComponent(name)}/similar?limit=${limit}`)
    } catch {
      return this.fallback.getSimilarRepos(name, limit)
    }
  }
}
