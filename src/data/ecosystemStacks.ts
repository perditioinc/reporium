/**
 * Curated Ecosystem Stacks — common AI/ML tool combinations.
 * Each stack shows repos that work well together for a specific goal.
 */

export interface StackRepo {
  /** Upstream owner/repo on GitHub */
  upstream: string;
  /** Human-readable name */
  name: string;
  /** What this repo does in the context of this stack */
  role: string;
  /** Stars (approximate, updated periodically) */
  stars?: number;
  /** Primary taxonomy category */
  category: string;
}

export interface EcosystemStack {
  id: string;
  title: string;
  tagline: string;
  /** Emoji icon for the stack */
  icon: string;
  /** Tailwind color class for the accent */
  accent: string;
  /** High-level use case tags */
  tags: string[];
  /** What you can build with this stack */
  whatYouBuild: string;
  repos: StackRepo[];
}

export const ECOSYSTEM_STACKS: EcosystemStack[] = [
  {
    id: 'rag-starter',
    title: 'RAG Starter Stack',
    tagline: 'Production-ready Retrieval-Augmented Generation in a weekend',
    icon: '🔍',
    accent: 'blue',
    tags: ['RAG', 'NLP', 'Vector Search'],
    whatYouBuild:
      'A document Q&A system that embeds your data, stores it in a vector database, retrieves semantically relevant chunks, and generates grounded answers with citations.',
    repos: [
      {
        upstream: 'langchain-ai/langchain',
        name: 'LangChain',
        role: 'Orchestration framework — chains retrieval, prompts, and LLM calls together',
        stars: 98000,
        category: 'rag-retrieval',
      },
      {
        upstream: 'chroma-core/chroma',
        name: 'Chroma',
        role: 'Embedded vector store — stores and queries document embeddings locally',
        stars: 17000,
        category: 'rag-retrieval',
      },
      {
        upstream: 'UKPLab/sentence-transformers',
        name: 'sentence-transformers',
        role: 'Embedding model — converts text to dense vectors for semantic search',
        stars: 16000,
        category: 'nlp-text',
      },
      {
        upstream: 'tiangolo/fastapi',
        name: 'FastAPI',
        role: 'API server — exposes your RAG pipeline as a REST endpoint',
        stars: 80000,
        category: 'dev-tools',
      },
    ],
  },
  {
    id: 'agent-builder',
    title: 'Agent Builder Stack',
    tagline: 'Multi-agent systems with memory, tools, and browser control',
    icon: '🤖',
    accent: 'purple',
    tags: ['Agents', 'Orchestration', 'Memory'],
    whatYouBuild:
      'An autonomous multi-agent system where specialized agents collaborate, share memory, browse the web, and complete complex multi-step tasks.',
    repos: [
      {
        upstream: 'crewAIInc/crewAI',
        name: 'CrewAI',
        role: 'Multi-agent orchestration — defines agent roles, goals, and crew collaboration',
        stars: 29000,
        category: 'ai-agents',
      },
      {
        upstream: 'langchain-ai/langgraph',
        name: 'LangGraph',
        role: 'Stateful agent graphs — models agentic workflows as directed graphs with cycles',
        stars: 12000,
        category: 'ai-agents',
      },
      {
        upstream: 'mem0ai/mem0',
        name: 'Mem0',
        role: 'Agent memory — persistent, context-aware memory layer across conversations',
        stars: 28000,
        category: 'ai-agents',
      },
      {
        upstream: 'gregpr07/browser-use',
        name: 'browser-use',
        role: 'Browser control — gives agents the ability to interact with real websites',
        stars: 19000,
        category: 'ai-agents',
      },
    ],
  },
  {
    id: 'fine-tuning',
    title: 'Fine-tuning Stack',
    tagline: 'Train and serve custom LLMs efficiently on consumer hardware',
    icon: '⚡',
    accent: 'amber',
    tags: ['Fine-tuning', 'Training', 'Inference'],
    whatYouBuild:
      'A custom LLM fine-tuned on your domain data — from dataset prep and QLoRA training through to quantized serving at production scale.',
    repos: [
      {
        upstream: 'unslothai/unsloth',
        name: 'Unsloth',
        role: 'Fast fine-tuning — 2x faster LoRA/QLoRA training with 70% less VRAM',
        stars: 27000,
        category: 'model-training',
      },
      {
        upstream: 'hiyouga/LLaMA-Factory',
        name: 'LLaMA-Factory',
        role: 'Training framework — unified interface for fine-tuning 100+ LLMs',
        stars: 42000,
        category: 'model-training',
      },
      {
        upstream: 'wandb/wandb',
        name: 'Weights & Biases',
        role: 'Experiment tracking — logs training metrics, hyperparams, and model artifacts',
        stars: 10000,
        category: 'observability',
      },
      {
        upstream: 'vllm-project/vllm',
        name: 'vLLM',
        role: 'High-throughput serving — PagedAttention-based LLM inference at scale',
        stars: 44000,
        category: 'inference-serving',
      },
    ],
  },
  {
    id: 'observability',
    title: 'LLM Observability Stack',
    tagline: 'Full-stack tracing, evals, and prompt management for production LLMs',
    icon: '📊',
    accent: 'green',
    tags: ['Observability', 'Evals', 'Tracing'],
    whatYouBuild:
      'A monitoring and evaluation system that traces every LLM call, measures quality over time, catches regressions before they reach users, and manages prompt versions.',
    repos: [
      {
        upstream: 'langfuse/langfuse',
        name: 'Langfuse',
        role: 'LLM observability — distributed tracing, cost tracking, and user feedback collection',
        stars: 9000,
        category: 'observability',
      },
      {
        upstream: 'Arize-ai/phoenix',
        name: 'Phoenix',
        role: 'ML observability — real-time monitoring, drift detection, and embedding visualization',
        stars: 5000,
        category: 'observability',
      },
      {
        upstream: 'traceloop/openllmetry',
        name: 'OpenLLMetry',
        role: 'OpenTelemetry for LLMs — vendor-neutral instrumentation for any LLM framework',
        stars: 2700,
        category: 'observability',
      },
      {
        upstream: 'promptfoo/promptfoo',
        name: 'promptfoo',
        role: 'Prompt testing — automated evals and regression tests for prompts and RAG pipelines',
        stars: 5900,
        category: 'evals-benchmarking',
      },
    ],
  },
  {
    id: 'ai-security',
    title: 'AI Security Stack',
    tagline: 'Defend LLM applications from prompt injection, jailbreaks, and toxic outputs',
    icon: '🛡️',
    accent: 'red',
    tags: ['Safety', 'Security', 'Guardrails'],
    whatYouBuild:
      'A defense-in-depth security layer that blocks prompt injection and jailbreaks at runtime, continuously red-teams your models for vulnerabilities, and enforces content policies.',
    repos: [
      {
        upstream: 'NVIDIA/NeMo-Guardrails',
        name: 'NeMo Guardrails',
        role: 'Runtime guardrails — programmable rules that block policy violations at inference time',
        stars: 4500,
        category: 'safety-alignment',
      },
      {
        upstream: 'leondz/garak',
        name: 'Garak',
        role: 'LLM red-teaming — automated vulnerability scanner for LLM security weaknesses',
        stars: 3600,
        category: 'safety-alignment',
      },
      {
        upstream: 'promptfoo/promptfoo',
        name: 'promptfoo',
        role: 'Adversarial prompt testing — runs red-team evals and injection test suites',
        stars: 5900,
        category: 'evals-benchmarking',
      },
      {
        upstream: 'Azure/PyRIT',
        name: 'PyRIT',
        role: 'Risk identification — Microsoft\'s framework for probing AI system risk surfaces',
        stars: 2200,
        category: 'safety-alignment',
      },
    ],
  },
  {
    id: 'mlops-platform',
    title: 'MLOps Platform Stack',
    tagline: 'End-to-end ML lifecycle: experiments, pipelines, deployment, and monitoring',
    icon: '🏗️',
    accent: 'teal',
    tags: ['MLOps', 'Infrastructure', 'Pipelines'],
    whatYouBuild:
      'A complete MLOps platform that tracks experiments, automates training pipelines, serves models with a feature store, and monitors production drift.',
    repos: [
      {
        upstream: 'mlflow/mlflow',
        name: 'MLflow',
        role: 'Experiment tracking and model registry — the backbone of most ML platforms',
        stars: 20000,
        category: 'mlops-infrastructure',
      },
      {
        upstream: 'zenml-io/zenml',
        name: 'ZenML',
        role: 'ML pipelines — portable, reproducible pipelines that run on any cloud',
        stars: 4300,
        category: 'mlops-infrastructure',
      },
      {
        upstream: 'feast-dev/feast',
        name: 'Feast',
        role: 'Feature store — consistent feature serving for training and real-time inference',
        stars: 5700,
        category: 'mlops-infrastructure',
      },
      {
        upstream: 'evidentlyai/evidently',
        name: 'Evidently',
        role: 'Model monitoring — detects data drift, target drift, and quality regressions',
        stars: 5600,
        category: 'observability',
      },
    ],
  },
];

export const ACCENT_CLASSES: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  blue:   { border: 'border-blue-800/60',   bg: 'bg-blue-950/20',   text: 'text-blue-400',   badge: 'bg-blue-900/40 text-blue-300' },
  purple: { border: 'border-purple-800/60', bg: 'bg-purple-950/20', text: 'text-purple-400', badge: 'bg-purple-900/40 text-purple-300' },
  amber:  { border: 'border-amber-800/60',  bg: 'bg-amber-950/20',  text: 'text-amber-400',  badge: 'bg-amber-900/40 text-amber-300' },
  green:  { border: 'border-green-800/60',  bg: 'bg-green-950/20',  text: 'text-green-400',  badge: 'bg-green-900/40 text-green-300' },
  red:    { border: 'border-red-800/60',    bg: 'bg-red-950/20',    text: 'text-red-400',    badge: 'bg-red-900/40 text-red-300' },
  teal:   { border: 'border-teal-800/60',   bg: 'bg-teal-950/20',   text: 'text-teal-400',   badge: 'bg-teal-900/40 text-teal-300' },
};
