import {
  mergeAggregatesIntoLibraryData,
  previewToLibraryData,
} from '@/lib/previewToLibraryData'
import type { AggregatesData, PreviewData } from '@/lib/dataProvider'
import type { LibraryData } from '@/types/repo'

describe('previewToLibraryData', () => {
  test('produces a LibraryData with empty aggregates and a hydrated repos array', () => {
    const preview: PreviewData = {
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
          stars: 10,
          forks: 1,
          lastUpdated: '2026-05-01T00:00:00Z',
          primaryCategory: 'agents',
          dbCategory: 'agents',
          enrichedTags: ['agents'],
          isArchived: false,
          url: 'https://github.com/p/demo',
        },
      ],
    }

    const data = previewToLibraryData(preview)
    expect(data.repos).toHaveLength(1)
    expect(data.tagMetrics).toEqual([])
    expect(data.categories).toEqual([])
    expect(data.builderStats).toEqual([])
    expect(data.aiDevSkillStats).toEqual([])
    expect(data.pmSkillStats).toEqual([])
    expect(data.gapAnalysis.gaps).toEqual([])
  })
})

describe('mergeAggregatesIntoLibraryData KAN-189', () => {
  const baseLibrary: LibraryData = {
    username: 'test',
    generatedAt: '2026-05-03T00:00:00Z',
    stats: { total: 1, built: 0, forked: 1, languages: ['Python'], topTags: [] },
    repos: [
      {
        id: 1,
        name: 'demo',
        fullName: 'p/demo',
        description: null,
        isFork: true,
        forkedFrom: 'upstream/demo',
        language: 'Python',
        topics: [],
        enrichedTags: ['agents'],
        stars: 10,
        forks: 1,
        openIssuesCount: 0,
        licenseSpdx: null,
        lastUpdated: '2026-05-01T00:00:00Z',
        url: 'https://github.com/p/demo',
        isArchived: false,
        readmeSummary: null,
        parentStats: null,
        recentCommits: [],
        createdAt: null,
        forkedAt: null,
        yourLastPushAt: null,
        upstreamLastPushAt: null,
        upstreamCreatedAt: null,
        forkSync: null,
        weeklyCommitCount: 0,
        languageBreakdown: {},
        languagePercentages: {},
        commitsLast7Days: [],
        commitsLast30Days: [],
        commitsLast90Days: [],
        totalCommitsFetched: 0,
        primaryCategory: 'agents',
        allCategories: ['agents'],
        dbCategory: 'agents',
        commitStats: { today: 0, last7Days: 0, last30Days: 0, last90Days: 0, recentCommits: [] },
        latestRelease: null,
        aiDevSkills: [],
        pmSkills: [],
        industries: [],
        programmingLanguages: ['Python'],
        builders: [],
        taxonomy: [],
        qualitySignals: null,
      },
    ],
    tagMetrics: [],
    categories: [],
    gapAnalysis: { generatedAt: '2026-05-03T00:00:00Z', gaps: [] },
    builderStats: [],
    aiDevSkillStats: [],
    pmSkillStats: [],
    totalRepos: 1,
  }

  const aggregates: AggregatesData = {
    generatedAt: '2026-05-03T01:00:00Z',
    totalRepos: 1870,
    stats: { total: 1870, built: 19, forked: 1851, languages: ['Python', 'TypeScript'], topTags: ['Python'] },
    gapAnalysis: { generatedAt: '2026-05-03T01:00:00Z', gaps: [] },
    tagMetrics: [
      {
        tag: 'demo',
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
    categories: [{ id: 'agents', name: 'Agents', description: '', tags: [], color: '#000', icon: '🤖', repoCount: 100 }],
    builderStats: [{ login: 'microsoft', displayName: 'Microsoft', category: 'big-tech', repoCount: 66, totalParentStars: 1, topRepos: [], avatarUrl: '' }],
    aiDevSkillStats: [{ skill: 'Foundation Model Architecture', lifecycleGroup: 'Foundation & Training', repoCount: 456, coverage: 'strong', topRepos: [] }],
    pmSkillStats: [{ skill: 'AI-Native Architecture', repoCount: 582, coverage: 'strong', topRepos: [] }],
  }

  test('grafts aggregates onto a preview-derived LibraryData and preserves repos', () => {
    const merged = mergeAggregatesIntoLibraryData(baseLibrary, aggregates)
    expect(merged.repos).toBe(baseLibrary.repos) // unchanged repos array reference
    expect(merged.username).toBe('test') // preserved
    expect(merged.tagMetrics).toHaveLength(1)
    expect(merged.tagMetrics[0].tag).toBe('demo')
    expect(merged.categories).toHaveLength(1)
    expect(merged.builderStats[0].login).toBe('microsoft')
    expect(merged.aiDevSkillStats[0].skill).toBe('Foundation Model Architecture')
    expect(merged.pmSkillStats[0].skill).toBe('AI-Native Architecture')
    expect(merged.stats.total).toBe(1870)
    expect(merged.totalRepos).toBe(1870)
    expect(merged.generatedAt).toBe('2026-05-03T01:00:00Z')
  })

  test('returns a NEW object (does not mutate base)', () => {
    const merged = mergeAggregatesIntoLibraryData(baseLibrary, aggregates)
    expect(merged).not.toBe(baseLibrary)
    // base aggregates remain empty post-merge
    expect(baseLibrary.tagMetrics).toEqual([])
    expect(baseLibrary.builderStats).toEqual([])
  })
})
