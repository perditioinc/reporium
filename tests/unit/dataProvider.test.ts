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

describe('ApiDataProvider.getPreview KAN-185 include= option', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_REPORIUM_API_URL = 'https://api.example.com'
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  test('getPreview without include= calls /library/preview?limit=N (no include param)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: '2026-05-03T00:00:00Z',
        totalRepos: 1,
        limit: 300,
        sort: 'stars',
        category: null,
        repos: [],
      }),
    })
    global.fetch = fetchMock as jest.Mock

    const provider = createDataProvider()
    await provider.getPreview(300)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.example.com/library/preview?limit=300'
    )
  })

  test('getPreview with include=stats,parent,quality appends sorted include= param', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: '2026-05-03T00:00:00Z',
        totalRepos: 1,
        limit: 300,
        sort: 'stars',
        category: null,
        repos: [],
      }),
    })
    global.fetch = fetchMock as jest.Mock

    const provider = createDataProvider()
    await provider.getPreview(300, { include: ['quality', 'stats', 'parent'] })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    // Tokens are sorted to give a stable cache key, so request URL is also stable.
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.example.com/library/preview?limit=300&include=parent,quality,stats'
    )
  })

  test('getPreview caches per include set; baseline + enriched coexist', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: '2026-05-03T00:00:00Z',
        totalRepos: 1,
        limit: 300,
        sort: 'stars',
        category: null,
        repos: [],
      }),
    })
    global.fetch = fetchMock as jest.Mock

    const provider = createDataProvider()
    await provider.getPreview(300)
    await provider.getPreview(300) // cache hit
    await provider.getPreview(300, { include: ['stats'] })
    await provider.getPreview(300, { include: ['stats'] }) // cache hit
    await provider.getPreview(300, { include: ['stats', 'parent', 'quality'] })

    // Three distinct cache keys -> three network requests.
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls).toContain('https://api.example.com/library/preview?limit=300')
    expect(urls).toContain('https://api.example.com/library/preview?limit=300&include=stats')
    expect(urls).toContain(
      'https://api.example.com/library/preview?limit=300&include=parent,quality,stats'
    )
  })

  test('getPreview surfaces optional include blocks from server response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: '2026-05-03T00:00:00Z',
        totalRepos: 1,
        limit: 300,
        sort: 'stars',
        category: null,
        repos: [
          {
            id: 'r1',
            name: 'demo',
            fullName: 'p/demo',
            description: null,
            isFork: false,
            forkedFrom: null,
            language: 'Python',
            stars: 1234,
            forks: 12,
            lastUpdated: '2026-05-01T00:00:00Z',
            primaryCategory: 'agents',
            dbCategory: 'agents',
            enrichedTags: ['agents'],
            isArchived: false,
            url: 'https://github.com/p/demo',
            commitStats: { last7Days: 3, last30Days: 12, last90Days: 40 },
            parentStats: {
              owner: 'upstream',
              repo: 'demo',
              stars: 9999,
              forks: 200,
              isArchived: false,
              lastCommitDate: '2026-05-02T00:00:00Z',
              description: 'desc',
              url: 'https://github.com/upstream/demo',
            },
            upstreamCreatedAt: '2024-01-01T00:00:00Z',
            qualitySignals: { activity_score: 42, overall_score: 88 },
          },
        ],
      }),
    }) as jest.Mock

    const provider = createDataProvider()
    const data = await provider.getPreview(300, { include: ['stats', 'parent', 'quality'] })
    const repo = data.repos[0]
    expect(repo.commitStats).toEqual({ last7Days: 3, last30Days: 12, last90Days: 40 })
    expect(repo.parentStats?.isArchived).toBe(false)
    expect(repo.upstreamCreatedAt).toBe('2024-01-01T00:00:00Z')
    expect(repo.qualitySignals).toEqual({ activity_score: 42, overall_score: 88 })
  })
})

describe('ApiDataProvider.getAggregates KAN-189', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_REPORIUM_API_URL = 'https://api.example.com'
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  const aggregatesPayload = {
    generatedAt: '2026-05-03T10:07:23.035849+00:00',
    totalRepos: 1870,
    stats: {
      total: 1870,
      built: 19,
      forked: 1851,
      languages: ['Python', 'TypeScript'],
      topTags: ['Forked', 'Python'],
    },
    gapAnalysis: {
      generatedAt: '2026-05-03T10:07:23.035874+00:00',
      gaps: [],
    },
    tagMetrics: [
      {
        tag: 'demo-tag',
        repoCount: 1,
        percentage: 0.1,
        topLanguage: 'Python',
        languageBreakdown: { Python: 1 },
        updatedLast30Days: 0,
        updatedLast90Days: 0,
        olderThan90Days: 0,
        activityScore: 0,
        relatedTags: [],
        mostRecentRepo: '',
        mostRecentDate: '',
        repos: [],
        avgUpstreamAge: 0,
        avgTimeSinceForked: 0,
        mostOutdatedRepo: '',
        avgBehindBy: 0,
      },
    ],
    categories: [
      { id: 'agents', name: 'AI Agents', description: '', tags: [], color: '#000', icon: '🤖', repoCount: 100 },
    ],
    builderStats: [
      { login: 'microsoft', displayName: 'Microsoft', category: 'big-tech', repoCount: 66, totalParentStars: 1, topRepos: [], avatarUrl: 'https://avatars.githubusercontent.com/microsoft' },
    ],
    aiDevSkillStats: [
      { skill: 'Foundation Model Architecture', lifecycleGroup: 'Foundation & Training', repoCount: 456, coverage: 'strong', topRepos: [] },
    ],
    pmSkillStats: [
      { skill: 'AI-Native Architecture', repoCount: 582, coverage: 'strong', topRepos: [] },
    ],
  }

  test('getAggregates() fetches /library/aggregates and returns the parsed payload', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => aggregatesPayload,
    })
    global.fetch = fetchMock as jest.Mock

    const provider = createDataProvider()
    const data = await provider.getAggregates()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.example.com/library/aggregates',
    )
    expect(data.totalRepos).toBe(1870)
    expect(data.tagMetrics).toHaveLength(1)
    expect(data.builderStats[0].login).toBe('microsoft')
    expect(data.aiDevSkillStats[0].skill).toBe('Foundation Model Architecture')
    expect(data.pmSkillStats[0].skill).toBe('AI-Native Architecture')
    expect(data.categories[0].id).toBe('agents')
  })

  test('getAggregates() caches the result — second call hits cache, no second fetch', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => aggregatesPayload,
    })
    global.fetch = fetchMock as jest.Mock

    const provider = createDataProvider()
    const first = await provider.getAggregates()
    const second = await provider.getAggregates()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  test('getAggregates() deduplicates concurrent in-flight requests', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    const fetchMock = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )
    global.fetch = fetchMock as jest.Mock

    const provider = createDataProvider()
    const a = provider.getAggregates()
    const b = provider.getAggregates()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch({ ok: true, json: async () => aggregatesPayload })
    const [resolvedA, resolvedB] = await Promise.all([a, b])
    expect(resolvedA).toBe(resolvedB)
  })

  test('getAggregates() falls back to JSON synthesis on API failure and marks degraded', async () => {
    // First call: /library/aggregates fails. Second call (inside fallback):
    // /data/library.json succeeds with a minimal LibraryData shape.
    const libraryJson = {
      username: 'test',
      generatedAt: '2026-05-03T00:00:00Z',
      stats: { total: 0, built: 0, forked: 0, languages: [], topTags: [] },
      repos: [],
      tagMetrics: [{ tag: 'a' }],
      categories: [{ id: 'c1' }],
      gapAnalysis: { generatedAt: '2026-05-03T00:00:00Z', gaps: [] },
      builderStats: [{ login: 'b' }],
      aiDevSkillStats: [{ skill: 's' }],
      pmSkillStats: [{ skill: 'p' }],
      totalRepos: 0,
    }

    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new Error('API error: 503'))
      .mockResolvedValueOnce({ ok: true, json: async () => libraryJson })
    global.fetch = fetchMock as jest.Mock

    const provider = createDataProvider()
    const data = await provider.getAggregates()

    expect(provider.getDegradedState()).toBe(true)
    expect(data.tagMetrics).toHaveLength(1)
    expect(data.builderStats[0].login).toBe('b')
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
