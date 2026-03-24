'use client';

import { LibraryData, TagMetrics } from '@/types/repo';
import { CATEGORIES } from '@/lib/buildCategories';
interface StatsBarProps {
  data: LibraryData;
  tagMetrics?: TagMetrics[];
  onTagClick?: (tag: string) => void;
}

/** Returns a relative time string like "2 months ago" */
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

const SYSTEM_TAGS = new Set(['Forked', 'Fork', 'Built by Me', 'Active', 'Inactive', 'Archived', 'Popular']);

/**
 * Curated keep-list of ~100 AI-specific tags.
 * The tag cloud is filtered to only show tags from this set (case-insensitive).
 */
const CURATED_TAG_KEEPLIST = new Set([
  'transformer', 'attention', 'llm', 'rag', 'fine-tuning', 'lora', 'qlora', 'peft', 'rlhf', 'dpo',
  'quantization', 'distillation', 'pruning', 'vllm', 'tgi', 'inference', 'embeddings', 'vector-search',
  'langchain', 'langgraph', 'autogen', 'openai', 'anthropic', 'claude', 'gpt', 'gemini', 'llama',
  'mistral', 'phi', 'mixtral', 'mcp', 'function-calling', 'structured-output', 'json-schema',
  'prompt-engineering', 'chain-of-thought', 'agent', 'multi-agent', 'tool-use', 'rag-pipeline',
  'chunking', 're-ranking', 'faiss', 'qdrant', 'weaviate', 'pinecone', 'chroma', 'guardrails',
  'red-teaming', 'jailbreak', 'content-moderation', 'evals', 'benchmarks', 'openai-evals',
  'lm-evaluation-harness', 'mlflow', 'wandb', 'dvc', 'mlops', 'diffusion', 'stable-diffusion',
  'flux', 'comfyui', 'controlnet', 'whisper', 'tts', 'asr', 'vision-language', 'clip', 'sam',
  'yolo', 'detectron', 'segment-anything', 'protein-folding', 'alphafold', 'drug-discovery',
  'robotics', 'ros', 'sim-to-real', 'recommendation', 'collaborative-filtering', 'knowledge-graph',
  'graphrag', 'neo4j', 'edge-ai', 'mobile-ml', 'onnx', 'tensorrt', 'webgpu', 'synthetic-data',
  'data-augmentation', 'dataset', 'computer-vision', 'nlp', 'multimodal', 'speech', 'audio',
  'image-generation', 'video-generation', 'code-generation', 'coding-assistant',
]);

/** Data-rich stats panel for the library */
export function StatsBar({ data, tagMetrics, onTagClick }: StatsBarProps) {
  const { stats, repos, username, generatedAt } = data;

  // All unique tags across all repos
  const allTags = new Set<string>();
  for (const repo of repos) {
    for (const tag of repo.enrichedTags) allTags.add(tag);
  }

  // Most recently updated repo
  const mostRecent = [...repos].sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  )[0];

  // Repos updated in last 30 days
  const thirtyDaysAgo = new Date(generatedAt);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const activeCount = repos.filter(
    (r) => new Date(r.lastUpdated) >= thirtyDaysAgo
  ).length;

  // Top 6 languages with counts
  const langCounts = new Map<string, number>();
  for (const repo of repos) {
    if (repo.language) langCounts.set(repo.language, (langCounts.get(repo.language) ?? 0) + 1);
  }
  const topLangs = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Always exactly 58 hardcoded categories — never derived from tags
  const categoryCount = CATEGORIES.length;

  // Top builders (up to 9 known orgs by repo count)
  const topBuilders = (data.builderStats ?? [])
    .filter(b => b.category !== 'individual')
    .slice(0, 25);

  // AI Dev Coverage — use raw stats so skill keys always match
  const aiDevStats = data.aiDevSkillStats ?? [];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
      {/* Row 1: identity + core counts */}
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        {/* Identity */}
        <div>
          <p className="text-xs text-zinc-500">Library</p>
          <p className="text-lg font-bold text-zinc-100">{username}</p>
          <p className="text-xs text-zinc-600 mt-0.5">
            Updated {new Date(generatedAt).toLocaleTimeString()}
          </p>
        </div>

        {/* Core counts */}
        <div className="flex gap-6">
          <div>
            <p className="text-2xl font-bold text-zinc-100">{stats.total}</p>
            <p className="text-xs text-zinc-500">Repos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-400">{stats.built}</p>
            <p className="text-xs text-zinc-500">Built</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-violet-400">{stats.forked}</p>
            <p className="text-xs text-zinc-500">Forked</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-400">{activeCount}</p>
            <p className="text-xs text-zinc-500">Active 30d</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-100">{allTags.size}</p>
            <p className="text-xs text-zinc-500">Unique Tags</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-100">{categoryCount}</p>
            <p className="text-xs text-zinc-500">Categories</p>
          </div>
        </div>

        {/* Most recent */}
        {mostRecent && (
          <div>
            <p className="text-xs text-zinc-500">Most Recent</p>
            <p className="text-sm font-semibold text-zinc-200 truncate max-w-[160px]">
              {mostRecent.name}
            </p>
            <p className="text-xs text-zinc-500">{relativeTime(mostRecent.lastUpdated)}</p>
          </div>
        )}
      </div>

      {/* Row 2: top languages */}
      {topLangs.length > 0 && (
        <div className="pt-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">Languages</p>
          <div className="flex flex-wrap gap-2">
            {topLangs.map(([lang, count]) => (
              <span key={lang} className="flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300">
                <span className="font-medium">{lang}</span>
                <span className="text-zinc-500">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Row 3: top builders */}
      {topBuilders.length > 0 && (
        <div className="pt-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">Builders</p>
          <div className="flex flex-wrap gap-2">
            {topBuilders.map(b => (
              <button
                key={b.login}
                onClick={() => console.log('Builder filter:', b.login)}
                className="flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.avatarUrl} alt={b.displayName} className="w-4 h-4 rounded-full" />
                <span>{b.displayName}</span>
                <span className="text-zinc-500">{b.repoCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Row 4: AI Dev Coverage */}
      <div className="pt-3 border-t border-zinc-800">
        <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">AI Dev Coverage</p>
        <div className="flex flex-wrap gap-1.5">
          {aiDevStats.map(stat => {
            const count = stat.repoCount;
            const icon = count >= 10 ? '✅' : count >= 3 ? '⚠️' : '❌';
            const color = count >= 10 ? 'text-emerald-400' : count >= 3 ? 'text-yellow-400' : 'text-red-400';
            return (
              <span
                key={stat.skill}
                title={`${count} repos`}
                className={`flex items-center gap-1 rounded-full bg-zinc-800/60 border border-zinc-700/50 px-2.5 py-1 text-xs ${color}`}
              >
                <span>{icon}</span>
                <span className="text-zinc-300">{stat.skill}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Tag Cloud */}
      {tagMetrics && tagMetrics.length > 0 && (
        <div className="pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">Tag Cloud</p>
          <div className="flex flex-wrap gap-x-3 gap-y-2">
            {(() => {
              const visibleMetrics = tagMetrics
                .filter((m) => !SYSTEM_TAGS.has(m.tag) && CURATED_TAG_KEEPLIST.has(m.tag.toLowerCase()))
                .sort((a, b) => b.repoCount - a.repoCount)
                .slice(0, 30);
              const maxCount = visibleMetrics[0]?.repoCount ?? 1;
              return visibleMetrics.map((m) => {
                const fontSize = Math.min(48, Math.max(12, 12 + (Math.log(m.repoCount + 1) / Math.log(maxCount + 1)) * 36));
                const opacity = 0.4 + (m.activityScore / 100) * 0.6;
                return (
                  <button
                    key={m.tag}
                    onClick={() => onTagClick?.(m.tag)}
                    style={{ fontSize: `${fontSize}px`, opacity }}
                    className="text-zinc-300 hover:text-blue-400 transition-colors leading-tight"
                  >
                    {m.tag}
                  </button>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
