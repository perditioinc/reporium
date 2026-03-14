import { buildGapAnalysis, getCoverageLevel } from '@/lib/buildGapAnalysis';
import { EnrichedRepo } from '@/types/repo';

function makeRepo(overrides: Partial<EnrichedRepo>): EnrichedRepo {
  return {
    id: Math.random(),
    name: 'repo',
    fullName: 'user/repo',
    description: null,
    isFork: false,
    forkedFrom: null,
    language: null,
    topics: [],
    enrichedTags: [],
    stars: 0,
    forks: 0,
    lastUpdated: new Date().toISOString(),
    url: 'https://github.com/user/repo',
    isArchived: false,
    readmeSummary: null,
    parentStats: null,
    recentCommits: [],
    createdAt: new Date().toISOString(),
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
    primaryCategory: '',
    allCategories: [],
    commitStats: { today: 0, last7Days: 0, last30Days: 0, last90Days: 0, recentCommits: [] },
    latestRelease: null,
    aiDevSkills: [],
    pmSkills: [],
    industries: [],
    programmingLanguages: [],
    builders: [],
    ...overrides,
  };
}

describe('buildGapAnalysis', () => {
  it('returns a GapAnalysis object with generatedAt and gaps array', () => {
    const result = buildGapAnalysis([]);
    expect(result).toHaveProperty('generatedAt');
    expect(result).toHaveProperty('gaps');
    expect(Array.isArray(result.gaps)).toBe(true);
    expect(typeof result.generatedAt).toBe('string');
  });

  it('detects missing observability tools when user has none', () => {
    const repos = [makeRepo({ name: 'some-llm-repo', enrichedTags: ['Large Language Models'] })];
    const result = buildGapAnalysis(repos);
    const observabilityGap = result.gaps.find(g => g.skill === 'Observability & Monitoring');
    expect(observabilityGap).toBeDefined();
    expect(observabilityGap?.popularMissingRepos.length).toBeGreaterThan(0);
  });

  it('does not flag a tool as missing if user has a repo with that tag', () => {
    // User has a repo with the 'Ollama' tag — should not be flagged as missing in essentialRepos
    const repos = [makeRepo({ name: 'my-ollama-project', enrichedTags: ['Ollama', 'LLM Serving'] })];
    const result = buildGapAnalysis(repos);
    const inferenceGap = result.gaps.find(g => g.skill === 'Inference & Serving');
    if (inferenceGap) {
      const hasOllama = inferenceGap.popularMissingRepos.some(r => r.name === 'ollama');
      expect(hasOllama).toBe(false);
    }
  });

  it('does not flag a tool as missing if user has a repo whose name contains the tool name', () => {
    const repos = [makeRepo({ name: 'my-vllm-fork', enrichedTags: [] })];
    const result = buildGapAnalysis(repos);
    const inferenceGap = result.gaps.find(g => g.skill === 'Inference & Serving');
    if (inferenceGap) {
      const hasVllm = inferenceGap.popularMissingRepos.some(r => r.name === 'vllm');
      expect(hasVllm).toBe(false);
    }
  });

  it('each gap has required fields', () => {
    const repos = [makeRepo({ name: 'repo', enrichedTags: [] })];
    const result = buildGapAnalysis(repos);
    for (const gap of result.gaps) {
      expect(typeof gap.skill).toBe('string');
      expect(typeof gap.category).toBe('string');
      expect(typeof gap.yourRepoCount).toBe('number');
      expect(typeof gap.repoCount).toBe('number');
      expect(typeof gap.description).toBe('string');
      expect(Array.isArray(gap.suggestedTags)).toBe(true);
      expect(Array.isArray(gap.popularMissingRepos)).toBe(true);
      expect(Array.isArray(gap.essentialRepos)).toBe(true);
      expect(Array.isArray(gap.yourRepos)).toBe(true);
      expect(typeof gap.severity).toBe('string');
    }
  });

  it('includes at most 3 popular missing repos per gap', () => {
    const repos = [makeRepo({ name: 'repo', enrichedTags: [] })];
    const result = buildGapAnalysis(repos);
    for (const gap of result.gaps) {
      expect(gap.popularMissingRepos.length).toBeLessThanOrEqual(3);
    }
  });

  it('description says "critical gap" for skills with 0 repos', () => {
    const repos = [makeRepo({ name: 'repo', enrichedTags: [], allCategories: [] })];
    const result = buildGapAnalysis(repos);
    const zeroCountGaps = result.gaps.filter(g => g.yourRepoCount === 0);
    for (const gap of zeroCountGaps) {
      expect(gap.description).toContain('critical gap');
    }
  });

  it('when all toolkit skills are covered, all gaps have severity strong or moderate', () => {
    // Cover all 10 skill areas with sufficient repos
    const repos = [
      makeRepo({ name: 'langfuse', enrichedTags: ['Langfuse', 'Monitoring', 'Observability'] }),
      makeRepo({ name: 'phoenix', enrichedTags: ['Phoenix', 'Observability'] }),
      makeRepo({ name: 'openlit', enrichedTags: ['OpenLIT', 'Tracing'] }),
      makeRepo({ name: 'deepeval', enrichedTags: ['Evals', 'DeepEval'] }),
      makeRepo({ name: 'ragas', enrichedTags: ['Evals', 'RAGAS'] }),
      makeRepo({ name: 'openai-evals', enrichedTags: ['Evals', 'Model Evaluation'] }),
      makeRepo({ name: 'lm-eval', enrichedTags: ['Evals', 'LM Eval Harness', 'Benchmarking'] }),
      makeRepo({ name: 'vllm', enrichedTags: ['vLLM', 'Inference'] }),
      makeRepo({ name: 'llama-cpp', enrichedTags: ['llama.cpp', 'Inference'] }),
      makeRepo({ name: 'ollama', enrichedTags: ['Ollama', 'LLM Serving'] }),
      makeRepo({ name: 'inference-extra', enrichedTags: ['Quantization', 'Inference'] }),
      makeRepo({ name: 'instructor', enrichedTags: ['Instructor', 'Structured Output'] }),
      makeRepo({ name: 'outlines', enrichedTags: ['Outlines', 'Structured Output'] }),
      makeRepo({ name: 'guidance', enrichedTags: ['Guidance', 'Guardrails'] }),
      makeRepo({ name: 'mem0', enrichedTags: ['Mem0', 'Agent Memory'] }),
      makeRepo({ name: 'letta', enrichedTags: ['Letta / MemGPT', 'Agent Memory'] }),
      makeRepo({ name: 'context-extra', enrichedTags: ['Context Engineering', 'Long Context'] }),
      makeRepo({ name: 'unsloth', enrichedTags: ['Unsloth', 'Fine-Tuning'] }),
      makeRepo({ name: 'axolotl', enrichedTags: ['Axolotl', 'Fine-Tuning'] }),
      makeRepo({ name: 'trl', enrichedTags: ['TRL', 'RLHF', 'DPO'] }),
      makeRepo({ name: 'lora-extra', enrichedTags: ['LoRA / PEFT', 'Fine-Tuning'] }),
      makeRepo({ name: 'garak', enrichedTags: ['Garak', 'Red Teaming', 'AI Safety'] }),
      makeRepo({ name: 'pyrit', enrichedTags: ['PyRIT', 'Security'] }),
      makeRepo({ name: 'security-extra', enrichedTags: ['Prompt Injection', 'Guardrails'] }),
      makeRepo({ name: 'mlflow', enrichedTags: ['MLflow', 'Experiment Tracking'] }),
      makeRepo({ name: 'wandb', enrichedTags: ['Weights & Biases', 'MLOps'] }),
      makeRepo({ name: 'dvc', enrichedTags: ['DVC', 'MLOps'] }),
      makeRepo({ name: 'openhands', enrichedTags: ['OpenHands', 'Coding Assistant'] }),
      makeRepo({ name: 'cline', enrichedTags: ['Cline', 'Coding Assistant'] }),
      makeRepo({ name: 'aider', enrichedTags: ['Aider', 'Coding Assistant'] }),
      makeRepo({ name: 'deepseek-r1', enrichedTags: ['Reasoning Models', 'DeepSeek'] }),
      makeRepo({ name: 'open-r1', enrichedTags: ['Reasoning Models', 'Chain of Thought'] }),
    ];
    const result = buildGapAnalysis(repos);
    // All gaps should be either 'strong' or 'moderate' (not missing or weak)
    for (const gap of result.gaps) {
      expect(['strong', 'moderate']).toContain(gap.severity);
    }
  });
});

describe('getCoverageLevel', () => {
  it('returns missing for 0 repos', () => {
    expect(getCoverageLevel(0, 3, 1)).toBe('missing');
  });
  it('returns weak for count below moderate threshold', () => {
    expect(getCoverageLevel(1, 4, 2)).toBe('weak');  // 1 < 2 (moderateThreshold)
  });
  it('returns moderate for count between moderate and strong threshold', () => {
    expect(getCoverageLevel(2, 4, 2)).toBe('moderate');  // 2 >= 2 but < 4
  });
  it('returns strong for count at or above strong threshold', () => {
    expect(getCoverageLevel(4, 4, 2)).toBe('strong');
  });
});

describe('gap severity', () => {
  it('gap with 0 matching repos has severity missing', () => {
    const result = buildGapAnalysis([]);
    const obsGap = result.gaps.find(g => g.skill === 'Observability & Monitoring');
    expect(obsGap?.severity).toBe('missing');
  });

  it('gap includes yourRepos when user has matching repo', () => {
    const repos = [makeRepo({ name: 'my-langfuse', enrichedTags: ['Langfuse', 'Monitoring'] })];
    const result = buildGapAnalysis(repos);
    const obsGap = result.gaps.find(g => g.skill === 'Observability & Monitoring');
    expect(obsGap?.yourRepos).toContain('my-langfuse');
  });

  it('gaps are sorted with missing first', () => {
    const result = buildGapAnalysis([]);
    const severities = result.gaps.map(g => g.severity);
    // All should be 'missing' when no repos
    expect(severities.every(s => s === 'missing')).toBe(true);
  });

  it('gap has essentialRepos with owner, repo, reason fields', () => {
    const result = buildGapAnalysis([]);
    const gap = result.gaps[0];
    expect(gap.essentialRepos.length).toBeGreaterThan(0);
    expect(gap.essentialRepos[0]).toHaveProperty('owner');
    expect(gap.essentialRepos[0]).toHaveProperty('repo');
    expect(gap.essentialRepos[0]).toHaveProperty('reason');
  });
});
