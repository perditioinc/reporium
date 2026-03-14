import { EnrichedRepo, GapAnalysis, Gap, GapSeverity } from '@/types/repo';

/** 2026 essential AI toolkit — skill areas every serious AI engineer/PM needs */
const ESSENTIAL_TOOLKIT_2026 = [
  {
    skill: 'Observability & Monitoring',
    why: 'You cannot optimize or debug production AI without observability. This is the #1 gap in most AI teams.',
    trend: 'LLM observability is the fastest growing AI infra category in 2025-2026.',
    essentialRepos: [
      { owner: 'langfuse', repo: 'langfuse', reason: 'Standard for LLM tracing and prompt management' },
      { owner: 'Arize-ai', repo: 'phoenix', reason: 'Open source LLM observability and evals' },
      { owner: 'openlit', repo: 'openlit', reason: 'OpenTelemetry-native, one line integration' },
    ],
    strongThreshold: 3,
    moderateThreshold: 1,
    tags: ['Langfuse', 'Phoenix', 'OpenLIT', 'OpenLLMetry', 'Helicone', 'Monitoring', 'Tracing', 'LLM Monitoring', 'Observability'],
  },
  {
    skill: 'Evals & Benchmarking',
    why: 'Without evals, you are shipping AI blindly. Production AI teams run evals in CI on every deploy.',
    trend: 'Evals moved from research to standard engineering practice in 2025. Every serious team uses them.',
    essentialRepos: [
      { owner: 'confident-ai', repo: 'deepeval', reason: 'pytest for LLMs — run in CI pipeline' },
      { owner: 'explodinggradients', repo: 'ragas', reason: 'RAG-specific evaluation, critical for RAG pipelines' },
      { owner: 'openai', repo: 'evals', reason: 'Standard eval framework from OpenAI' },
      { owner: 'EleutherAI', repo: 'lm-evaluation-harness', reason: 'Standard for benchmarking open models' },
    ],
    strongThreshold: 4,
    moderateThreshold: 2,
    tags: ['Evals', 'DeepEval', 'RAGAS', 'Benchmarking', 'LM Eval Harness', 'Model Evaluation'],
  },
  {
    skill: 'Inference & Serving',
    why: 'vLLM changed inference. PagedAttention and continuous batching are now table stakes for serving LLMs.',
    trend: 'Inference optimization is the hottest AI infra topic of early 2026. Token throughput is the new benchmark.',
    essentialRepos: [
      { owner: 'vllm-project', repo: 'vllm', reason: 'Fastest open source LLM inference. Industry standard.' },
      { owner: 'ggerganov', repo: 'llama.cpp', reason: 'Run any model locally. Foundation of local AI.' },
      { owner: 'ollama', repo: 'ollama', reason: '150k stars. Easiest way to run models locally.' },
    ],
    strongThreshold: 4,
    moderateThreshold: 2,
    tags: ['vLLM', 'llama.cpp', 'Ollama', 'TGI', 'SGLang', 'LLM Serving', 'Inference', 'Quantization'],
  },
  {
    skill: 'Structured Output & Reliability',
    why: 'Getting reliable structured data from LLMs is unsolved for most teams. Instructor and Outlines solve this.',
    trend: 'Structured outputs became critical in 2025 as agents need reliable JSON. Pydantic + LLMs is now standard.',
    essentialRepos: [
      { owner: 'jxnl', repo: 'instructor', reason: 'Structured outputs using Pydantic. 9.5k stars.' },
      { owner: 'dottxt-ai', repo: 'outlines', reason: 'Guaranteed structured generation. 11k stars.' },
      { owner: 'microsoft', repo: 'guidance', reason: 'Control LLM output structure. From Microsoft.' },
    ],
    strongThreshold: 3,
    moderateThreshold: 1,
    tags: ['Instructor', 'Outlines', 'Guidance', 'Structured Output', 'Guardrails', 'Pydantic'],
  },
  {
    skill: 'Agent Memory & Context',
    why: 'Stateful agents require persistent memory. This is the core unsolved problem for production agents in 2026.',
    trend: 'Agent memory frameworks are the #1 accelerating category in commit velocity in early 2026.',
    essentialRepos: [
      { owner: 'mem0ai', repo: 'mem0', reason: 'Memory layer for AI. 26k stars and growing fast.' },
      { owner: 'letta-ai', repo: 'letta', reason: 'Stateful agents with persistent memory (MemGPT).' },
    ],
    strongThreshold: 3,
    moderateThreshold: 1,
    tags: ['Agent Memory', 'Letta / MemGPT', 'Mem0', 'Context Engineering', 'Long Context'],
  },
  {
    skill: 'Model Fine-tuning',
    why: 'Generic models are not good enough for production. Fine-tuning on domain data is becoming standard practice.',
    trend: 'Unsloth made fine-tuning 2x faster with 70% less memory. Barrier to fine-tuning dropped significantly in 2025.',
    essentialRepos: [
      { owner: 'unslothai', repo: 'unsloth', reason: '2x faster fine-tuning, 70% less memory. 28k stars.' },
      { owner: 'OpenAccess-AI-Collective', repo: 'axolotl', reason: 'Production fine-tuning toolkit.' },
      { owner: 'huggingface', repo: 'trl', reason: 'RLHF, DPO, GRPO training from HuggingFace.' },
    ],
    strongThreshold: 4,
    moderateThreshold: 2,
    tags: ['Unsloth', 'Axolotl', 'TRL', 'Fine-Tuning', 'LoRA / PEFT', 'RLHF', 'DPO'],
  },
  {
    skill: 'Security & AI Safety',
    why: 'Prompt injection and jailbreaks are real attack vectors. AI security is now a production concern, not just research.',
    trend: 'Enterprises are requiring AI security audits before deployment. Red teaming tools are seeing rapid adoption.',
    essentialRepos: [
      { owner: 'leondz', repo: 'garak', reason: 'LLM vulnerability scanner. Standard red team tool.' },
      { owner: 'Azure', repo: 'PyRIT', reason: "Microsoft's Python Risk Identification Toolkit." },
    ],
    strongThreshold: 3,
    moderateThreshold: 1,
    tags: ['AI Safety', 'Red Teaming', 'Garak', 'PyRIT', 'Prompt Injection', 'Guardrails', 'Security'],
  },
  {
    skill: 'MLOps & Experiment Tracking',
    why: 'Reproducibility and experiment tracking are essential for iterating on models in production.',
    trend: 'MLflow became the default open source experiment tracker. Integration with LLM workflows is now standard.',
    essentialRepos: [
      { owner: 'mlflow', repo: 'mlflow', reason: 'Experiment tracking and model registry. 19k stars.' },
      { owner: 'wandb', repo: 'wandb', reason: 'Weights & Biases SDK. Training visualization.' },
      { owner: 'iterative', repo: 'dvc', reason: 'Git for ML datasets. 14k stars.' },
    ],
    strongThreshold: 3,
    moderateThreshold: 1,
    tags: ['MLflow', 'Weights & Biases', 'DVC', 'MLOps', 'Experiment Tracking', 'ZenML'],
  },
  {
    skill: 'Coding Assistants',
    why: 'AI coding agents are the fastest productivity multiplier for engineers in 2026. Essential for any AI-native team.',
    trend: 'OpenHands (50k stars), Cline (40k), and Aider (25k) are transforming how engineers work.',
    essentialRepos: [
      { owner: 'All-Hands-AI', repo: 'OpenHands', reason: 'Open source Devin. 50k stars. Fastest growing.' },
      { owner: 'cline', repo: 'cline', reason: 'Autonomous coding in VS Code. 40k stars.' },
      { owner: 'paul-gauthier', repo: 'aider', reason: 'Pair programming with LLMs. 25k stars.' },
    ],
    strongThreshold: 3,
    moderateThreshold: 1,
    tags: ['OpenHands', 'Cline', 'Continue.dev', 'Aider', 'Claude Code', 'Coding Assistant'],
  },
  {
    skill: 'Reasoning Models',
    why: 'DeepSeek-R1 and OpenAI o3 changed what reasoning models can do. Understanding this space is essential for AI PMs.',
    trend: 'Reasoning models are the defining AI story of early 2026. Open source reasoning now matches closed models.',
    essentialRepos: [
      { owner: 'deepseek-ai', repo: 'DeepSeek-R1', reason: 'Open reasoning model that shocked the industry.' },
      { owner: 'huggingface', repo: 'open-r1', reason: 'Open source DeepSeek-R1 reproduction from HuggingFace.' },
    ],
    strongThreshold: 2,
    moderateThreshold: 1,
    tags: ['Reasoning Models', 'DeepSeek', 'Chain of Thought', 'Planning / CoT'],
  },
] as const;

/**
 * Calculate coverage severity for a skill area.
 * @param repoCount - number of repos covering this skill
 * @param strongThreshold - number needed for 'strong' coverage
 * @param moderateThreshold - number needed for 'moderate' coverage
 */
export function getCoverageLevel(
  repoCount: number,
  strongThreshold: number,
  moderateThreshold: number,
): GapSeverity {
  if (repoCount === 0) return 'missing';
  if (repoCount < moderateThreshold) return 'weak';
  if (repoCount < strongThreshold) return 'moderate';
  return 'strong';
}

/**
 * Analyzes the user's library against the 2026 essential AI toolkit.
 * Never makes external API calls — uses only library data.
 *
 * @param repos - All enriched repos
 * @returns GapAnalysis with identified gaps
 */
export function buildGapAnalysis(repos: EnrichedRepo[]): GapAnalysis {
  const gaps: Gap[] = [];

  for (const item of ESSENTIAL_TOOLKIT_2026) {
    // Find repos in the user's library that cover this skill
    const coveringRepos = repos.filter(r =>
      item.tags.some(tag => r.enrichedTags.includes(tag)) ||
      item.essentialRepos.some(e =>
        r.name.toLowerCase().includes(e.repo.toLowerCase()) ||
        (r.forkedFrom ?? '').toLowerCase().includes(e.repo.toLowerCase())
      )
    );

    const repoCount = coveringRepos.length;
    const severity = getCoverageLevel(repoCount, item.strongThreshold, item.moderateThreshold);

    // Find which essential repos are missing
    const missingEssential = item.essentialRepos.filter(e =>
      !repos.some(r =>
        r.name.toLowerCase().includes(e.repo.toLowerCase()) ||
        (r.forkedFrom ?? '').toLowerCase().includes(e.repo.toLowerCase())
      )
    );

    gaps.push({
      skill: item.skill,
      severity,
      repoCount,
      strongThreshold: item.strongThreshold,
      why: item.why,
      trend: item.trend,
      essentialRepos: [...item.essentialRepos],
      yourRepos: coveringRepos.map(r => r.name).slice(0, 5),
      // legacy fields for backwards compat
      category: item.skill,
      yourRepoCount: repoCount,
      description: repoCount === 0
        ? `You have no repos covering ${item.skill}. This is a critical gap.`
        : `You have ${repoCount} repo${repoCount !== 1 ? 's' : ''} covering ${item.skill}.`,
      suggestedTags: [...item.tags],
      popularMissingRepos: missingEssential.slice(0, 3).map(e => ({
        name: e.repo,
        stars: 0,
        url: `https://github.com/${e.owner}/${e.repo}`,
        description: e.reason,
      })),
    });
  }

  // Sort: missing first, then weak, moderate, strong
  const severityOrder: GapSeverity[] = ['missing', 'weak', 'moderate', 'strong'];
  gaps.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));

  return {
    generatedAt: new Date().toISOString(),
    gaps,
  };
}
