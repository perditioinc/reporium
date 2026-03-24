import { readFileSync } from 'fs';
import { join } from 'path';
import { notFound } from 'next/navigation';
import type { LibraryData } from '@/types/repo';
import { AI_DEV_SKILLS } from '@/lib/buildTaxonomy';
import { WikiNavBar } from '@/components/WikiNavBar';
import { WikiRepoCard } from '@/components/WikiRepoCard';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getLibraryData(): LibraryData | null {
  try { return JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'library.json'), 'utf-8')); }
  catch { return null; }
}

export async function generateStaticParams() {
  return Object.keys(AI_DEV_SKILLS).map(s => ({ skill: slugify(s) }));
}

/** Static teaching content per skill */
const SKILL_CONTENT: Record<string, {
  what: string;
  whyForPMs: string;
  landscape2026: string;
  strongCoverage: string;
  keyConcepts: string[];
}> = {
  'Observability & Monitoring': {
    what: 'Tracking every LLM call, prompt, response, latency, cost and quality metric in production. Observability gives you full visibility into what your AI system is actually doing at runtime.',
    whyForPMs: "You can't improve what you can't measure. Cost overruns, quality regressions, and silent failures are completely invisible without observability. Every production AI incident investigation starts here.",
    landscape2026: 'Langfuse, Phoenix, and OpenLIT are the leading open source tools. OpenTelemetry is becoming the standard tracing protocol. The space has consolidated significantly in 2025.',
    strongCoverage: 'Having 3+ observability repos signals a team that takes production AI seriously. They are monitoring costs, tracking prompt versions, and running LLM-as-judge evaluations on live traffic.',
    keyConcepts: ['Traces and spans for LLM calls', 'LLM-as-judge evaluation', 'Cost per token tracking', 'Prompt versioning and A/B testing', 'Latency percentiles (p50, p95, p99)'],
  },
  'Evals & Benchmarking': {
    what: 'Systematic testing of LLM outputs for quality, accuracy, and safety — run automatically in CI pipelines, just like unit tests. Evals catch regressions before they reach users.',
    whyForPMs: 'Prevents quality regressions when models or prompts change. Without evals, every model upgrade is a gamble. Enterprise AI deployment increasingly requires documented eval results.',
    landscape2026: 'DeepEval and RAGAS are the community standards. Running evals in CI is now table stakes for production AI teams. The OpenAI evals framework popularized the approach.',
    strongCoverage: '4+ eval repos indicates an engineering culture that treats AI quality like software quality. They catch regressions automatically and can confidently ship model upgrades.',
    keyConcepts: ['LLM-as-judge evaluation', 'RAG metrics: faithfulness, relevance, context recall', 'Red teaming and adversarial testing', 'Benchmark suites (MMLU, HumanEval)', 'Regression detection in CI'],
  },
  'Inference & Serving': {
    what: 'Efficiently serving LLM predictions at scale — optimizing for throughput (tokens/second), latency (time to first token), and cost (dollars per million tokens).',
    whyForPMs: 'Inference cost is typically 60-80% of AI product cost. PagedAttention in vLLM reduced serving costs by 10x for many teams. This directly impacts your product economics.',
    landscape2026: 'vLLM dominates production serving. llama.cpp and Ollama power local inference. SGLang is emerging for structured generation workloads. The gap between open and closed inference is closing fast.',
    strongCoverage: '4+ inference repos signals deep investment in serving efficiency. These teams are squeezing maximum performance from their hardware and have explored the full inference stack.',
    keyConcepts: ['PagedAttention and KV cache management', 'Continuous batching', 'Quantization (GGUF, GGML, AWQ)', 'Speculative decoding', 'Token throughput vs latency tradeoffs'],
  },
  'Model Training & Fine-tuning': {
    what: 'Adapting pre-trained models to specific domains, tasks, or behaviors using your own data. Fine-tuning can dramatically outperform prompt engineering on specialized tasks.',
    whyForPMs: 'Generic models underperform on domain-specific tasks by 15-40% in most enterprise use cases. Fine-tuning on 1,000 domain examples often beats the best prompts on the largest models.',
    landscape2026: 'Unsloth made fine-tuning accessible — 2x speed, 70% less memory. LoRA/QLoRA is the standard efficient method. GRPO (from DeepSeek) has replaced PPO as the preferred RL method.',
    strongCoverage: '4+ fine-tuning repos indicates a team that has moved beyond off-the-shelf models. They are customizing behavior, reducing hallucination on domain tasks, and building proprietary model capabilities.',
    keyConcepts: ['LoRA and QLoRA (parameter-efficient fine-tuning)', 'RLHF, DPO, and GRPO (alignment techniques)', 'Supervised fine-tuning (SFT) on instruction data', 'Synthetic data generation', 'Catastrophic forgetting prevention'],
  },
  'Structured Output & Reliability': {
    what: 'Getting LLMs to reliably return structured data (JSON, typed objects, specific formats) rather than freeform text. Essential for agentic systems that process LLM output programmatically.',
    whyForPMs: 'Agents fail catastrophically when LLMs return malformed output. Instructor and Outlines solve this with Pydantic validation and automatic retry. Reliability is the #1 production AI concern.',
    landscape2026: 'Instructor (9.5k stars) is the Python standard. Outlines provides mathematically guaranteed structured generation. JSON mode from OpenAI popularized the need; open tools now match it.',
    strongCoverage: '3+ structured output repos indicates a team building reliable agent pipelines. They have solved the "LLM returns garbage" problem and can trust their agents to produce valid data.',
    keyConcepts: ['Pydantic validation and retry logic', 'JSON schema enforcement', 'Function calling and tool use', 'Output parsers and structured generation', 'Grammar-constrained decoding'],
  },
  'AI Agents & Orchestration': {
    what: 'Systems where LLMs plan, use tools, and execute multi-step tasks autonomously. Agents are the primary AI product paradigm of 2026 — moving from chatbots to autonomous workers.',
    whyForPMs: 'Agents are the primary AI product paradigm of 2026. Understanding orchestration frameworks, tool calling, and multi-agent coordination is essential for building and shipping AI products.',
    landscape2026: 'LangGraph is the standard for stateful agents. CrewAI for multi-agent teams. MCP (Model Context Protocol) is standardizing tool integration across the ecosystem.',
    strongCoverage: 'Strong agent coverage signals a team that has moved from RAG to full agentic systems. They understand state management, tool orchestration, and multi-agent coordination.',
    keyConcepts: ['ReAct pattern (reason + act)', 'Tool calling and MCP', 'Agent memory and state management', 'Multi-agent coordination', 'Human-in-the-loop workflows'],
  },
  'RAG & Knowledge': {
    what: 'Augmenting LLMs with retrieved context from your own knowledge base at inference time. RAG enables using proprietary data without fine-tuning and dramatically reduces hallucination.',
    whyForPMs: 'Eliminates hallucination on domain knowledge. Enables real-time data without retraining. RAG is now the default architecture for enterprise AI — it is the solved, production-ready approach.',
    landscape2026: 'Basic RAG is solved. The frontier is Advanced RAG: GraphRAG for multi-hop reasoning, hybrid search (BM25 + dense), and reranking. LlamaIndex and LangChain are the main frameworks.',
    strongCoverage: 'Strong RAG coverage signals a mature knowledge management strategy. These teams have moved beyond basic similarity search to hybrid retrieval, reranking, and graph-based knowledge.',
    keyConcepts: ['Chunking strategies and overlap', 'Embedding models and vector databases', 'Hybrid search (BM25 + dense vectors)', 'Reranking with cross-encoders', 'GraphRAG for multi-hop reasoning'],
  },
  'Context Engineering': {
    what: 'Strategically managing what information goes into an LLM\'s context window for optimal performance. Context quality determines output quality more than model choice in most real-world cases.',
    whyForPMs: 'Context window management is the difference between agents that work and agents that hallucinate or loop. Understanding this is critical for debugging and improving AI product quality.',
    landscape2026: 'Mem0 and Letta/MemGPT are the leading tools for persistent agent memory. Context compression and retrieval-augmented memory are active research areas becoming production tools.',
    strongCoverage: 'Strong context engineering coverage shows a team thinking deeply about agent reliability. They manage context budgets, compress history, and persist important information across sessions.',
    keyConcepts: ['Context window limits and token budgets', 'Sliding window and memory compression', 'Retrieval vs storage tradeoffs', 'KV cache optimization', 'Long-context models and their tradeoffs'],
  },
  'Security & Safety': {
    what: 'Testing LLMs for vulnerabilities, preventing prompt injection attacks, and ensuring AI systems behave safely in production. AI security is now a standard engineering discipline.',
    whyForPMs: 'Prompt injection is a real attack vector that can compromise entire agentic workflows. Enterprises now require security audits and red team reports before approving AI deployment.',
    landscape2026: 'Garak is the standard LLM vulnerability scanner. PyRIT from Microsoft for enterprise red teaming. The field has matured significantly — AI security is now a job title, not just a research topic.',
    strongCoverage: '3+ security repos signals a team that takes AI safety seriously. They red team their systems, test for prompt injection, and have guardrails before deployment.',
    keyConcepts: ['Prompt injection and indirect injection', 'Jailbreaking and model misuse', 'Red teaming and vulnerability scanning', 'Output filtering and guardrails', 'PII detection and data privacy'],
  },
  'Coding Assistants & Dev Tools': {
    what: 'AI-powered tools that help engineers write, debug, review, and refactor code autonomously. The fastest-moving category in developer tools, with 10x productivity improvements reported.',
    whyForPMs: 'Coding agents are the #1 AI productivity multiplier for engineering teams in 2026. Understanding this space helps you plan AI-native development workflows and make better tooling decisions.',
    landscape2026: 'OpenHands (50k stars) leads open source agentic coding. Cline dominates VS Code. Aider excels at terminal workflows. Claude Code and Gemini CLI are the major commercial options.',
    strongCoverage: '3+ coding assistant repos indicates a team that has seriously explored AI-assisted development. They have moved beyond autocomplete to agentic coding and autonomous code review.',
    keyConcepts: ['Agentic coding and autonomous file editing', 'SWE-bench evaluation for coding agents', 'Context management for large codebases', 'Test generation and code review automation', 'Multi-file editing and refactoring'],
  },
  'MLOps & Data': {
    what: 'Tools for managing the ML lifecycle — experiment tracking, data versioning, pipeline orchestration, and model registry. The engineering infrastructure behind reliable AI development.',
    whyForPMs: 'Reproducibility and iteration speed determine how fast a team can improve their AI product. Without MLOps, teams waste time on "what did we try?" and "why did this model break?"',
    landscape2026: 'MLflow is the standard open source experiment tracker. DVC for data versioning. Ray for distributed training. The MLOps stack has stabilized — most teams use 3-4 tools from this category.',
    strongCoverage: '3+ MLOps repos signals engineering discipline around AI development. These teams can reproduce any experiment, track data lineage, and reliably ship model updates.',
    keyConcepts: ['Experiment tracking and reproducibility', 'Model registry and versioning', 'Data versioning with DVC or Delta Lake', 'Pipeline orchestration (Airflow, Prefect, ZenML)', 'Feature stores for training/serving consistency'],
  },
  'Multimodal & Vision': {
    what: 'AI systems that process and generate multiple modalities — combining image, video, audio and text understanding in a single model or pipeline.',
    whyForPMs: 'Multimodal AI is the next major product wave. GPT-4V, Gemini Vision, and Claude\'s vision capabilities are enabling entirely new product categories that were impossible 2 years ago.',
    landscape2026: 'Qwen2.5-VL and InternVL are the leading open vision-language models. SAM2 is standard for segmentation. Wan2.1 for video generation. The open source multimodal stack is now production-ready.',
    strongCoverage: 'Strong multimodal coverage shows a team building products that go beyond text. They understand vision-language models, image generation pipelines, and audio processing.',
    keyConcepts: ['Vision-language models (VLMs)', 'Image-text contrastive learning (CLIP)', 'Video understanding and temporal reasoning', 'Audio-visual learning', 'Segment Anything and zero-shot segmentation'],
  },
  'Reasoning Models': {
    what: 'Models specifically trained to reason step-by-step through complex problems before answering. Reasoning models use extended "thinking" to dramatically improve accuracy on hard tasks.',
    whyForPMs: 'Reasoning models changed what AI can reliably do on complex tasks. Understanding when to use them (hard multi-step tasks) vs standard models (fast, cheap, conversational) is a key product architecture decision.',
    landscape2026: 'DeepSeek-R1 (open source) shocked the industry by matching o1 on many benchmarks. Open-R1 from HuggingFace reproduced the training recipe. Test-time compute scaling is the active research frontier.',
    strongCoverage: '2+ reasoning model repos signals a team tracking the frontier of AI capabilities. They understand chain-of-thought, test-time compute, and when reasoning models justify the cost.',
    keyConcepts: ['Chain of thought and extended thinking', 'Test-time compute scaling', 'Thinking tokens and scratch pads', 'GRPO training for reasoning', 'Math and coding benchmarks (AIME, SWE-bench)'],
  },
};

/** Coverage indicator display */
function CoverageIndicator({ count, strongThreshold }: { count: number; strongThreshold: number }) {
  if (count === 0) return <span className="text-red-400 font-medium">✗ Missing — critical gap</span>;
  if (count < 2) return <span className="text-orange-400 font-medium">⚠ Weak — {count} repo</span>;
  if (count < strongThreshold) return <span className="text-yellow-400 font-medium">~ Moderate — {count} repos</span>;
  return <span className="text-emerald-400 font-medium">✓ Strong — {count} repos</span>;
}

export default async function SkillPage({ params }: { params: Promise<{ skill: string }> }) {
  const { skill } = await params;
  const skillName = Object.keys(AI_DEV_SKILLS).find(s => slugify(s) === skill);
  if (!skillName) notFound();

  const data = getLibraryData();
  if (!data) return (
    <div>
      <WikiNavBar title={skillName} />
      <div className="p-8 text-zinc-400">No data. Run <code className="bg-zinc-800 px-1 rounded">npm run generate</code>.</div>
    </div>
  );

  const skillTags = AI_DEV_SKILLS[skillName];
  const repos = data.repos
    .filter(r => (r.aiDevSkills ?? []).some(a => a.skill === skillName))
    .sort((a, b) => (b.parentStats?.stars ?? 0) - (a.parentStats?.stars ?? 0));

  const gapEntry = data.gapAnalysis?.gaps?.find(g => g.skill === skillName || g.category === skillName);
  const strongThreshold = gapEntry?.strongThreshold ?? 8;
  const content = SKILL_CONTENT[skillName];

  return (
    <div>
      <WikiNavBar title={skillName} />
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <p className="text-xs text-zinc-500 mb-1">AI Dev Skills</p>
          <h1 className="text-2xl font-bold text-zinc-100">{skillName}</h1>
          <div className="mt-2">
            <CoverageIndicator count={repos.length} strongThreshold={strongThreshold} />
          </div>
        </div>

        {content && (
          <>
            {/* What is it */}
            <section>
              <h2 className="text-base font-semibold text-zinc-300 mb-2">What is it?</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">{content.what}</p>
            </section>

            {/* Why it matters */}
            <section>
              <h2 className="text-base font-semibold text-zinc-300 mb-2">Why it matters for AI PMs</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">{content.whyForPMs}</p>
            </section>

            {/* 2026 landscape */}
            <section>
              <h2 className="text-base font-semibold text-zinc-300 mb-2">The 2026 landscape</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">{content.landscape2026}</p>
            </section>

            {/* Strong coverage */}
            <section>
              <h2 className="text-base font-semibold text-zinc-300 mb-2">What strong coverage looks like</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">{content.strongCoverage}</p>
            </section>
          </>
        )}

        {/* Your library */}
        <section>
          <h2 className="text-base font-semibold text-zinc-300 mb-3">
            Your library coverage ({repos.length} repos)
          </h2>
          {repos.length === 0 ? (
            <p className="text-sm text-zinc-500">No repos in this skill area yet.</p>
          ) : (
            <div className="space-y-2">
              {repos.slice(0, 15).map(repo => (
                <WikiRepoCard key={repo.name} repo={repo} />
              ))}
              {repos.length > 15 && (
                <p className="text-xs text-zinc-600">+ {repos.length - 15} more repos</p>
              )}
            </div>
          )}
        </section>

        {/* Gap — what you might be missing */}
        {gapEntry && gapEntry.essentialRepos && gapEntry.essentialRepos.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-zinc-300 mb-2">What you might be missing</h2>
            <p className="text-xs text-zinc-500 mb-3">{gapEntry.why}</p>
            <div className="space-y-2">
              {gapEntry.essentialRepos.slice(0, 3).map(e => (
                <a
                  key={e.repo}
                  href={`https://github.com/${e.owner}/${e.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 hover:border-zinc-700 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://github.com/${e.owner}.png?size=16`} alt={e.owner} className="w-4 h-4 rounded-full" />
                  <span className="text-sm font-medium text-zinc-300">{e.owner}/{e.repo}</span>
                  <span className="text-xs text-zinc-500 flex-1">{e.reason}</span>
                  <span className="text-xs text-zinc-600">↗</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Key concepts */}
        {content && (
          <section>
            <h2 className="text-base font-semibold text-zinc-300 mb-2">Key concepts to know</h2>
            <ul className="space-y-1.5">
              {content.keyConcepts.map(concept => (
                <li key={concept} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="text-zinc-600 mt-0.5">•</span>
                  <span>{concept}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Related tags */}
        <section>
          <h2 className="text-base font-semibold text-zinc-300 mb-2">Related tags</h2>
          <div className="flex flex-wrap gap-2">
            {skillTags.map(tag => (
              <a
                key={tag}
                href={`/?tag=${encodeURIComponent(tag)}`}
                className="rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
              >
                {tag}
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
