/**
 * Data provider abstraction.
 * Lite mode: reads from /data/library.json
 * Production mode: reads from NEXT_PUBLIC_REPORIUM_API_URL
 * Falls back to JSON if API is unreachable.
 */

import type { LibraryData, EnrichedRepo, TrendData, GapAnalysis } from '@/types/repo'

export type DataMode = 'lite' | 'production'

export interface DataProvider {
  mode: DataMode
  getLibrary(): Promise<LibraryData>
  getTrends(): Promise<TrendData | null>
  getGaps(): Promise<GapAnalysis | null>
  getRepo(name: string): Promise<EnrichedRepo | null>
  searchRepos(query: string): Promise<EnrichedRepo[]>
}

export function createDataProvider(): DataProvider {
  const apiUrl = process.env.NEXT_PUBLIC_REPORIUM_API_URL
  if (apiUrl) return new ApiDataProvider(apiUrl)
  return new JsonDataProvider()
}

class JsonDataProvider implements DataProvider {
  mode: DataMode = 'lite'

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

  async getLibrary(): Promise<LibraryData> {
    // Database backfilled 2026-03-21: 14K tags, 2K pmSkills, 918 industries, 825 builders.
    // API /library/full now returns rich data. Falls back to static JSON if API unreachable.
    try { return await this.apiFetch<LibraryData>('/library/full') }
    catch { console.warn('API unreachable, falling back to JSON'); return this.fallback.getLibrary() }
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

  async searchRepos(query: string): Promise<EnrichedRepo[]> {
    try { return await this.apiFetch<EnrichedRepo[]>(`/search?q=${encodeURIComponent(query)}`) }
    catch { return this.fallback.searchRepos(query) }
  }
}
