/**
 * Data provider abstraction.
 * Lite mode: reads from /data/library.json
 * Production mode: reads from NEXT_PUBLIC_REPORIUM_API_URL
 * Falls back to JSON if API is unreachable.
 */

import type { LibraryData, EnrichedRepo, TrendData, GapAnalysis, TaxonomyValueOption } from '@/types/repo'

export type DataMode = 'lite' | 'production'
export type SearchMode = 'keyword' | 'semantic'

export interface DataProvider {
  mode: DataMode
  getOwnedLibrary(): Promise<LibraryData | null>
  getLibrary(): Promise<LibraryData>
  getTrends(): Promise<TrendData | null>
  getGaps(): Promise<GapAnalysis | null>
  getRepo(name: string): Promise<EnrichedRepo | null>
  searchRepos(query: string, mode?: SearchMode): Promise<EnrichedRepo[]>
  getTaxonomyValues(dimension: string): Promise<TaxonomyValueOption[]>
}

export function createDataProvider(): DataProvider {
  const apiUrl = process.env.NEXT_PUBLIC_REPORIUM_API_URL
  if (apiUrl) return new ApiDataProvider(apiUrl)
  return new JsonDataProvider()
}

class JsonDataProvider implements DataProvider {
  mode: DataMode = 'lite'

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
}

class ApiDataProvider implements DataProvider {
  mode: DataMode = 'production'
  private apiUrl: string
  private fallback: JsonDataProvider

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

  async getLibrary(): Promise<LibraryData> {
    try {
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
      console.warn('API unreachable, falling back to JSON')
      return this.fallback.getLibrary()
    }
  }

  async getTrends(): Promise<TrendData | null> {
    try { return await this.apiFetch<TrendData>('/trends') }
    catch { return this.fallback.getTrends() }
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
}
