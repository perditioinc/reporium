import { createDataProvider } from '@/lib/dataProvider'

describe('createDataProvider', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
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
})
