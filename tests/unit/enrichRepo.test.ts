import { generateTags, enrichRepo, extractTagsFromReadme } from '@/lib/enrichRepo';

const baseRepo = {
  language: null,
  topics: [],
  stars: 0,
  lastUpdated: new Date().toISOString(),
  isFork: false,
  isArchived: false,
};

describe('generateTags', () => {
  it('gives Backend tag for Python repos', () => {
    const tags = generateTags({ ...baseRepo, language: 'Python' });
    expect(tags).toContain('Backend');
    expect(tags).toContain('Python');
  });

  it('gives Large Language Models tag for llm topic', () => {
    const tags = generateTags({ ...baseRepo, topics: ['llm'] });
    expect(tags).toContain('Large Language Models');
  });

  it('gives Large Language Models tag for anthropic topic', () => {
    const tags = generateTags({ ...baseRepo, topics: ['anthropic'] });
    expect(tags).toContain('Large Language Models');
  });

  it('gives Popular tag for repos with over 1000 stars', () => {
    const tags = generateTags({ ...baseRepo, stars: 1001 });
    expect(tags).toContain('Popular');
  });

  it('does not give Popular tag for repos with <= 1000 stars', () => {
    const tags = generateTags({ ...baseRepo, stars: 1000 });
    expect(tags).not.toContain('Popular');
  });

  it('gives Inactive tag for repos updated over 1 year ago', () => {
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 2);
    const tags = generateTags({ ...baseRepo, lastUpdated: oldDate.toISOString() });
    expect(tags).toContain('Inactive');
  });

  it('gives Active tag for repos updated within 30 days', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5);
    const tags = generateTags({ ...baseRepo, lastUpdated: recentDate.toISOString() });
    expect(tags).toContain('Active');
  });

  it('assigns Forked tag for forked repos', () => {
    const tags = generateTags({ ...baseRepo, isFork: true });
    expect(tags).toContain('Forked');
    expect(tags).not.toContain('Built by Me');
  });

  it('assigns Built by Me tag for non-forked repos', () => {
    const tags = generateTags({ ...baseRepo, isFork: false });
    expect(tags).toContain('Built by Me');
    expect(tags).not.toContain('Forked');
  });

  it('assigns Archived tag for archived repos', () => {
    const tags = generateTags({ ...baseRepo, isArchived: true });
    expect(tags).toContain('Archived');
  });

  it('deduplicates tags', () => {
    const tags = generateTags({ ...baseRepo, language: 'Python', topics: ['python'] });
    const set = new Set(tags);
    expect(tags.length).toBe(set.size);
  });
});

describe('enrichRepo', () => {
  it('returns a complete EnrichedRepo with enrichedTags and null readmeSummary', () => {
    const partial = {
      id: 1,
      name: 'test-repo',
      fullName: 'user/test-repo',
      description: 'A test repo',
      isFork: false,
      forkedFrom: null,
      language: 'TypeScript',
      topics: ['nextjs'],
      stars: 5,
      forks: 1,
      lastUpdated: new Date().toISOString(),
      url: 'https://github.com/user/test-repo',
      isArchived: false,
      createdAt: new Date().toISOString(),
      forkedAt: null,
      yourLastPushAt: null,
      upstreamLastPushAt: null,
      upstreamCreatedAt: null,
    };
    const enriched = enrichRepo(partial);
    expect(enriched.enrichedTags).toBeInstanceOf(Array);
    expect(enriched.readmeSummary).toBeNull();
    expect(enriched.enrichedTags).toContain('TypeScript');
    expect(enriched.enrichedTags).toContain('Frontend Framework');
  });
});

describe('extractTagsFromReadme', () => {
  it('extracts LLM tag from readme mentioning "large language model"', () => {
    const tags = extractTagsFromReadme('This project uses a large language model for generation.');
    expect(tags).toContain('Large Language Models');
  });

  it('extracts multiple tags from a rich readme', () => {
    const readme = 'Built with PyTorch and transformers. Uses retrieval augmented generation with a vector database. Deployed with Docker.';
    const tags = extractTagsFromReadme(readme);
    expect(tags).toContain('PyTorch');
    expect(tags).toContain('Transformers');
    expect(tags).toContain('RAG');
    expect(tags).toContain('Vector Database');
    expect(tags).toContain('Docker');
  });

  it('is case-insensitive', () => {
    const tags = extractTagsFromReadme('Using PYTORCH and CUDA for GPU training.');
    expect(tags).toContain('PyTorch');
    expect(tags).toContain('GPU / CUDA');
  });

  it('returns empty array for empty readme', () => {
    expect(extractTagsFromReadme('')).toEqual([]);
  });
});

describe('enrichRepo with readme', () => {
  it('merges readme tags with metadata tags', () => {
    const partial = {
      id: 1,
      name: 'test',
      fullName: 'user/test',
      description: null,
      isFork: false,
      forkedFrom: null,
      language: 'Python',
      topics: [],
      stars: 0,
      forks: 0,
      lastUpdated: new Date().toISOString(),
      url: 'https://github.com/user/test',
      isArchived: false,
      createdAt: new Date().toISOString(),
      forkedAt: null,
      yourLastPushAt: null,
      upstreamLastPushAt: null,
      upstreamCreatedAt: null,
    };
    const enriched = enrichRepo(partial, 'This uses PyTorch for deep learning with transformers.');
    expect(enriched.enrichedTags).toContain('Python');
    expect(enriched.enrichedTags).toContain('PyTorch');
    expect(enriched.enrichedTags).toContain('Deep Learning');
    expect(enriched.enrichedTags).toContain('Transformers');
  });

  it('sorts tags alphabetically', () => {
    const partial = {
      id: 2,
      name: 'test2',
      fullName: 'user/test2',
      description: null,
      isFork: false,
      forkedFrom: null,
      language: 'Python',
      topics: [],
      stars: 0,
      forks: 0,
      lastUpdated: new Date().toISOString(),
      url: 'https://github.com/user/test2',
      isArchived: false,
      createdAt: new Date().toISOString(),
      forkedAt: null,
      yourLastPushAt: null,
      upstreamLastPushAt: null,
      upstreamCreatedAt: null,
    };
    const enriched = enrichRepo(partial, 'Uses PyTorch and Docker and RAG.');
    const sorted = [...enriched.enrichedTags].sort();
    expect(enriched.enrichedTags).toEqual(sorted);
  });

  it('deduplicates tags across sources', () => {
    const partial = {
      id: 3,
      name: 'test3',
      fullName: 'user/test3',
      description: null,
      isFork: false,
      forkedFrom: null,
      language: 'Python',
      topics: ['machine-learning'],
      stars: 0,
      forks: 0,
      lastUpdated: new Date().toISOString(),
      url: 'https://github.com/user/test3',
      isArchived: false,
      createdAt: new Date().toISOString(),
      forkedAt: null,
      yourLastPushAt: null,
      upstreamLastPushAt: null,
      upstreamCreatedAt: null,
    };
    // Both topic map and readme map should produce 'Machine Learning'
    const enriched = enrichRepo(partial, 'This is a machine learning project.');
    const mlTags = enriched.enrichedTags.filter((t) => t === 'Machine Learning');
    expect(mlTags).toHaveLength(1);
  });
});
