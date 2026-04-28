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
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        repos: [
          { name: 'react-app', description: null, enrichedTags: [] },
          { name: 'vue-app', description: null, enrichedTags: [] },
        ],
      }),
    }) as jest.Mock

    delete process.env.NEXT_PUBLIC_REPORIUM_API_URL
    const provider = createDataProvider()
    const results = await provider.searchRepos('react')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('react-app')
  })

  test('production provider uses static owned data for first paint', async () => {
    process.env.NEXT_PUBLIC_REPORIUM_API_URL = 'https://api.example.com'

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ repos: [{ name: 'owned-a', description: null, enrichedTags: [] }] }),
    }) as jest.Mock

    const provider = createDataProvider()
    const first = await provider.getOwnedLibrary()

    expect(first?.repos[0].name).toBe('owned-a')
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain('/data/owned.json')
  })

  test('production provider falls back to small API preview when static owned data is unavailable', async () => {
    process.env.NEXT_PUBLIC_REPORIUM_API_URL = 'https://api.example.com'

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ repos: [{ name: 'repo-a', description: null, enrichedTags: [] }] }),
      }) as jest.Mock

    const provider = createDataProvider()
    const first = await provider.getOwnedLibrary()

    expect(first?.repos[0].name).toBe('repo-a')
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(String((global.fetch as jest.Mock).mock.calls[1][0])).toBe(
      'https://api.example.com/library/full?page=1&page_size=24'
    )
  })
})

describe('ApiDataProvider.apiFetch timeout', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_REPORIUM_API_URL = 'https://api.example.com'
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  test('apiFetch passes an AbortController signal to fetch', async () => {
    let capturedSignal: AbortSignal | undefined

    global.fetch = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined
      return Promise.resolve({ ok: true, json: async () => ({}) })
    }) as jest.Mock

    const provider = createDataProvider()
    await provider.getTrends()

    expect(capturedSignal).toBeInstanceOf(AbortSignal)
    expect(capturedSignal?.aborted).toBe(false)
  })

  test('apiFetch clears its timeout after a successful request', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'test', enrichedTags: [] }),
    }) as jest.Mock

    const provider = createDataProvider()
    await provider.getRepo('test')

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  test('apiFetch AbortController signal is aborted when timeout fires', async () => {
    let capturedSignal: AbortSignal | undefined
    let capturedController: AbortController | undefined

    const OriginalAbortController = global.AbortController
    jest.spyOn(global, 'AbortController').mockImplementationOnce(() => {
      capturedController = new OriginalAbortController()
      return capturedController
    })

    global.fetch = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined
      return new Promise((resolve) => {
        init?.signal?.addEventListener('abort', () => resolve({ ok: false, status: 499 } as Response))
      })
    }) as jest.Mock

    const provider = createDataProvider()
    provider.getTrends().catch(() => undefined)

    await Promise.resolve()

    expect(capturedSignal).toBeInstanceOf(AbortSignal)
    expect(capturedSignal?.aborted).toBe(false)

    capturedController?.abort()
    expect(capturedSignal?.aborted).toBe(true)
  })
})
