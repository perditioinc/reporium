import { createDataProvider } from '@/lib/dataProvider'

describe('createDataProvider', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  test('returns lite provider when NEXT_PUBLIC_REPORIUM_API_URL is not set', () => {
    delete process.env.NEXT_PUBLIC_REPORIUM_API_URL
    const provider = createDataProvider()
    expect(provider.mode).toBe('lite')
  })

  test('returns production provider when NEXT_PUBLIC_REPORIUM_API_URL is set', () => {
    process.env.NEXT_PUBLIC_REPORIUM_API_URL = 'https://api.example.com'
    const provider = createDataProvider()
    expect(provider.mode).toBe('production')
  })

  test('lite provider searchRepos filters by name', async () => {
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        repos: [
          { name: 'react-app', description: null, enrichedTags: [] },
          { name: 'vue-app', description: null, enrichedTags: [] },
        ]
      })
    }) as jest.Mock

    delete process.env.NEXT_PUBLIC_REPORIUM_API_URL
    const provider = createDataProvider()
    const results = await provider.searchRepos('react')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('react-app')
  })

  test('production provider retries page-1 fetch after rejection (page1Promise not sticky)', async () => {
    process.env.NEXT_PUBLIC_REPORIUM_API_URL = 'https://api.example.com'

    const successfulResponse = {
      ok: true,
      json: async () => ({ repos: [{ name: 'repo-a', description: null, enrichedTags: [] }] }),
    }

    // First call rejects, second call resolves — fetch should be called twice
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(successfulResponse) as jest.Mock

    const provider = createDataProvider()

    // First call: page-1 fetch fails, getOwnedLibrary swallows the error and returns null
    const first = await provider.getOwnedLibrary()
    expect(first).toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Second call: page1Promise was cleared on rejection, so a new fetch is made
    const second = await provider.getOwnedLibrary()
    expect(second).not.toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
