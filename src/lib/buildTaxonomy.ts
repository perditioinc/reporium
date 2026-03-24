/**
 * buildTaxonomy.ts
 * Multi-dimensional taxonomy mappings for Reporium.
 * Maps enriched tags → AI Dev Skills, PM Skills, Industries.
 * Also defines known builders/organizations.
 */

import type { EnrichedRepo, Builder, BuilderStats, SkillStats } from '@/types/repo';

/** AI Developer skill areas — maps skill name → tags that indicate it */
export const AI_DEV_SKILLS: Record<string, string[]> = {
  'Observability & Monitoring': [
    'Langfuse', 'Phoenix', 'OpenLIT', 'OpenLLMetry', 'Helicone',
    'Traceloop', 'Weights & Biases', 'MLflow', 'OpenTelemetry',
    'Monitoring', 'Tracing', 'LLM Monitoring'
  ],
  'Evals & Benchmarking': [
    'DeepEval', 'RAGAS', 'PromptFoo', 'LM Eval Harness', 'Evals',
    'Benchmarking', 'Red Teaming', 'Garak', 'PyRIT', 'MMLU', 'HumanEval'
  ],
  'Inference & Serving': [
    'vLLM', 'SGLang', 'TGI', 'Triton', 'TensorRT', 'ONNX',
    'llama.cpp', 'Llamafile', 'LLM Serving', 'Quantization',
    'Speculative Decoding', 'KV Cache', 'GPU / CUDA', 'Inference'
  ],
  'Model Training & Fine-tuning': [
    'Unsloth', 'Axolotl', 'TRL', 'TorchTune', 'LoRA / PEFT',
    'RLHF', 'DPO', 'GRPO', 'DeepSpeed', 'FSDP',
    'Synthetic Data', 'Distillation', 'Fine-Tuning', 'MergeKit'
  ],
  'Structured Output & Reliability': [
    'Instructor', 'Outlines', 'Guidance', 'Guardrails',
    'NeMo Guardrails', 'Structured Output', 'Tool Use', 'Pydantic'
  ],
  'AI Agents & Orchestration': [
    'AI Agents', 'LangChain', 'LangGraph', 'DSPy', 'Semantic Kernel',
    'Haystack', 'Agno', 'CrewAI', 'AutoGen', 'Swarm',
    'OpenAI Agents SDK', 'Multi-Agent', 'MCP', 'Autonomous Systems'
  ],
  'RAG & Knowledge': [
    'RAG', 'Vector Database', 'Embeddings', 'Knowledge Graph',
    'Chroma', 'Qdrant', 'Milvus', 'Weaviate', 'Pinecone', 'pgvector',
    'Reranking', 'Hybrid Search', 'GraphRAG', 'Document Processing',
    'LlamaIndex', 'LightRAG'
  ],
  'Context Engineering': [
    'Context Engineering', 'Agent Memory', 'Letta / MemGPT', 'Mem0',
    'Long Context', 'Planning / CoT', 'Prompt Engineering'
  ],
  'Security & Safety': [
    'AI Safety', 'Red Teaming', 'Garak', 'PyRIT', 'Prompt Injection',
    'Guardrails', 'Watermarking', 'Privacy-Preserving AI', 'Alignment'
  ],
  'Coding Assistants & Dev Tools': [
    'OpenHands', 'Cline', 'Continue.dev', 'Aider', 'SWE-Agent',
    'Claude Code', 'Gemini CLI', 'Kilocode', 'CLI Tool', 'Automation'
  ],
  'MLOps & Data': [
    'MLOps', 'DVC', 'ZenML', 'Prefect', 'Airflow', 'Ray',
    'Kubeflow', 'Feature Store', 'MLflow', 'Docker', 'Kubernetes',
    'CI/CD', 'Model Registry'
  ],
  'Multimodal & Vision': [
    'Computer Vision', 'Image Generation', 'Video Generation',
    'Multimodal AI', 'Point Cloud / 3D Vision', 'Object Detection',
    'Segmentation', 'Depth Estimation', '3D Reconstruction',
    'Text to Speech', 'Speech to Text', 'Music / Audio AI'
  ]
};

/** PM skill areas — maps skill name → tags that indicate it */
export const PM_SKILLS: Record<string, string[]> = {
  'Cost & Efficiency': [
    'LiteLLM', 'Quantization', 'LLM Serving', 'KV Cache',
    'Speculative Decoding', 'Caching', 'vLLM', 'Inference'
  ],
  'Safety & Alignment': [
    'AI Safety', 'Red Teaming', 'Guardrails', 'Garak', 'PyRIT',
    'Prompt Injection', 'Alignment', 'Privacy-Preserving AI'
  ],
  'User Experience': [
    'Text to Speech', 'Speech to Text', 'Multimodal AI',
    'Frontend', 'React / Next.js', 'Voice Cloning', 'WebXR'
  ],
  'Scale & Reliability': [
    'MLOps', 'Docker', 'Kubernetes', 'Ray', 'Monitoring',
    'Tracing', 'LLM Monitoring', 'Real-Time / Streaming'
  ],
  'Data & Evaluation': [
    'Evals', 'DeepEval', 'RAGAS', 'Benchmarking', 'Synthetic Data',
    'Data Science', 'Dataset', 'MLflow'
  ],
  'Product Discovery': [
    'RAG', 'Embeddings', 'Vector Database', 'Semantic Search',
    'Knowledge Graph', 'Reranking', 'Document Processing'
  ],
  'Developer Platform': [
    'API', 'SDK', 'CLI Tool', 'MCP', 'Tool Use', 'Automation',
    'Structured Output', 'Webhook'
  ],
  'AI-Native Architecture': [
    'AI Agents', 'Multi-Agent', 'Agent Memory', 'Context Engineering',
    'Planning / CoT', 'LangGraph', 'Autonomous Systems'
  ]
};

/** Industry verticals — maps industry name → tags that indicate it */
export const INDUSTRIES: Record<string, string[]> = {
  'Healthcare & Medicine': ['Healthcare AI', 'Medical Imaging', 'Drug Discovery', 'Clinical NLP', 'Bioinformatics'],
  'Finance & FinTech': ['FinTech', 'Trading AI', 'Risk Modeling', 'Fraud Detection'],
  'Audio & Music': ['Music Tech', 'Music / Audio AI', 'Music Generation', 'Audio Processing', 'Voice Cloning'],
  'Gaming & Entertainment': ['Game Dev', 'NPC AI', 'Procedural Generation'],
  'Robotics & Manufacturing': ['Robotics', 'Robot Arms', 'Robot Learning', 'Humanoid Robotics', 'SLAM'],
  'Spatial & Immersive': ['XR / Spatial Computing', 'Virtual Reality', 'Augmented Reality', 'WebXR', 'Apple Vision Pro'],
  'Developer Tools': ['CLI Tool', 'API', 'SDK', 'Automation', 'DevOps', 'CI/CD'],
  'Research & Academia': ['Research / Papers', 'Benchmarking', 'MMLU', 'HumanEval', 'Open Source']
};

/** Known builder organizations with metadata */
export const KNOWN_ORGS: Record<string, { category: 'big-tech' | 'ai-lab' | 'startup' | 'research' | 'individual'; displayName: string }> = {
  'google': { category: 'big-tech', displayName: 'Google' },
  'google-deepmind': { category: 'ai-lab', displayName: 'Google DeepMind' },
  'google-gemini': { category: 'big-tech', displayName: 'Google Gemini' },
  'microsoft': { category: 'big-tech', displayName: 'Microsoft' },
  'meta-llama': { category: 'big-tech', displayName: 'Meta' },
  'facebookresearch': { category: 'ai-lab', displayName: 'Meta Research' },
  'openai': { category: 'ai-lab', displayName: 'OpenAI' },
  'anthropics': { category: 'ai-lab', displayName: 'Anthropic' },
  'huggingface': { category: 'ai-lab', displayName: 'HuggingFace' },
  'mistralai': { category: 'ai-lab', displayName: 'Mistral AI' },
  'deepseek-ai': { category: 'ai-lab', displayName: 'DeepSeek' },
  'qwenlm': { category: 'ai-lab', displayName: 'Qwen / Alibaba' },
  'nvidia': { category: 'big-tech', displayName: 'NVIDIA' },
  'aws': { category: 'big-tech', displayName: 'Amazon AWS' },
  'apple': { category: 'big-tech', displayName: 'Apple' },
  'langchain-ai': { category: 'startup', displayName: 'LangChain' },
  'vllm-project': { category: 'startup', displayName: 'vLLM' },
  'unslothai': { category: 'startup', displayName: 'Unsloth' },
  'langfuse': { category: 'startup', displayName: 'Langfuse' },
  'chroma-core': { category: 'startup', displayName: 'Chroma' },
  'qdrant': { category: 'startup', displayName: 'Qdrant' },
  'weaviate': { category: 'startup', displayName: 'Weaviate' },
  'infiniflow': { category: 'startup', displayName: 'Infiniflow' },
  'arize-ai': { category: 'startup', displayName: 'Arize AI' },
  'confident-ai': { category: 'startup', displayName: 'Confident AI' },
  'run-llama': { category: 'startup', displayName: 'LlamaIndex' },
  'letta-ai': { category: 'startup', displayName: 'Letta' },
  'mem0ai': { category: 'startup', displayName: 'Mem0' },
  'crewaiinc': { category: 'startup', displayName: 'CrewAI' },
  'agno-agi': { category: 'startup', displayName: 'Agno' },
  'all-hands-ai': { category: 'startup', displayName: 'All Hands AI' },
  'cline': { category: 'startup', displayName: 'Cline' },
  'continuedev': { category: 'startup', displayName: 'Continue' },
  'browser-use': { category: 'startup', displayName: 'Browser Use' },
  'eleutherai': { category: 'ai-lab', displayName: 'EleutherAI' },
  'allenai': { category: 'ai-lab', displayName: 'Allen AI' },
  'stanford-crfm': { category: 'research', displayName: 'Stanford' },
  'mit-han-lab': { category: 'research', displayName: 'MIT Han Lab' },
};

/**
 * Assign taxonomy dimension — returns all dimension keys that have at least one matching tag.
 * @param tags - enrichedTags from a repo
 * @param dimensionMap - one of AI_DEV_SKILLS, PM_SKILLS, or INDUSTRIES
 */
export function assignDimension(tags: string[], dimensionMap: Record<string, string[]>): string[] {
  const result: string[] = [];
  for (const [dimension, dimensionTags] of Object.entries(dimensionMap)) {
    if (dimensionTags.some(t => tags.includes(t))) {
      result.push(dimension);
    }
  }
  return result;
}

/**
 * Build a Builder object for a repo.
 * For forked repos the builder is the upstream owner (from forkedFrom).
 * For built repos the builder is derived from fullName.
 */
export function buildBuilder(repo: Pick<EnrichedRepo, 'isFork' | 'forkedFrom' | 'fullName'>): Builder {
  const originalOwner = repo.isFork && repo.forkedFrom
    ? repo.forkedFrom.split('/')[0]
    : repo.fullName.split('/')[0];
  const key = originalOwner.toLowerCase();
  const knownOrg = KNOWN_ORGS[key];
  return {
    login: originalOwner,
    name: knownOrg?.displayName ?? originalOwner,
    type: knownOrg ? 'organization' : 'user',
    avatarUrl: `https://avatars.githubusercontent.com/${originalOwner}`,
    isKnownOrg: !!knownOrg,
    orgCategory: knownOrg?.category ?? 'individual',
  };
}

/**
 * Compute per-builder aggregated stats across all repos.
 */
export function buildBuilderStats(repos: EnrichedRepo[]): BuilderStats[] {
  const map = new Map<string, BuilderStats>();
  for (const repo of repos) {
    for (const builder of (repo.builders ?? [])) {
      const existing = map.get(builder.login);
      const stars = repo.parentStats?.stars ?? 0;
      if (!existing) {
        map.set(builder.login, {
          login: builder.login,
          displayName: builder.name ?? builder.login,
          category: (builder.orgCategory ?? 'individual') as BuilderStats['category'],
          repoCount: 1,
          totalParentStars: stars,
          topRepos: [repo.name],
          avatarUrl: builder.avatarUrl,
        });
      } else {
        existing.repoCount++;
        existing.totalParentStars += stars;
        if (existing.topRepos.length < 3) existing.topRepos.push(repo.name);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.repoCount - a.repoCount);
}

/**
 * Compute per-skill stats for a given dimension map.
 */
export function buildSkillStats(
  repos: EnrichedRepo[],
  field: 'aiDevSkills' | 'pmSkills'
): SkillStats[] {
  const map = new Map<string, { count: number; repos: string[] }>();
  for (const repo of repos) {
    for (const item of (repo[field] ?? [])) {
      const skillKey = typeof item === 'string' ? item : item.skill;
      const existing = map.get(skillKey);
      if (!existing) {
        map.set(skillKey, { count: 1, repos: [repo.name] });
      } else {
        existing.count++;
        if (existing.repos.length < 3) existing.repos.push(repo.name);
      }
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([skill, { count, repos }]) => ({
      skill,
      repoCount: count,
      coverage: count >= 10 ? 'strong' : count >= 3 ? 'moderate' : count >= 1 ? 'weak' : 'none',
      topRepos: repos,
    }));
}
