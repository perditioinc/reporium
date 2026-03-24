import { readFileSync } from 'fs';
import { join } from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { QualityBadge } from '@/components/QualityBadge';
import { WikiNavBar } from '@/components/WikiNavBar';
import { CATEGORIES } from '@/lib/buildCategories';
import type { EnrichedRepo, QualitySignals, SimilarRepo } from '@/types/repo';

const API_URL =
  process.env.NEXT_PUBLIC_REPORIUM_API_URL ??
  'https://reporium-api-573778300586.us-central1.run.app';

const SKILL_LIFECYCLE_GROUPS: Record<string, string> = {
  'Model Training & Fine-tuning': 'Foundation & Training',
  'Inference & Serving': 'Inference & Deployment',
  'Structured Output & Reliability': 'LLM Application Layer',
  'AI Agents & Orchestration': 'LLM Application Layer',
  'RAG & Knowledge': 'LLM Application Layer',
  'Context Engineering': 'LLM Application Layer',
  'Observability & Monitoring': 'Eval / Safety / Ops',
  'Evals & Benchmarking': 'Eval / Safety / Ops',
  'Security & Safety': 'Eval / Safety / Ops',
  'MLOps & Data': 'Eval / Safety / Ops',
  'Multimodal & Vision': 'Modality-Specific',
  'Coding Assistants & Dev Tools': 'Applied AI',
  'Reasoning Models': 'Applied AI',
};

interface RepoDetail {
  id: string;
  name: string;
  owner: string;
  description: string | null;
  is_fork: boolean;
  forked_from: string | null;
  primary_language: string | null;
  github_url: string;
  fork_sync_state: string | null;
  behind_by: number;
  ahead_by: number;
  upstream_created_at: string | null;
  forked_at: string | null;
  your_last_push_at: string | null;
  upstream_last_push_at: string | null;
  parent_stars: number | null;
  parent_forks: number | null;
  parent_is_archived: boolean;
  stargazers_count: number | null;
  open_issues_count: number;
  commits_last_7_days: number;
  commits_last_30_days: number;
  commits_last_90_days: number;
  readme_summary: string | null;
  activity_score: number;
  quality_signals: QualitySignals | null;
  ingested_at: string;
  updated_at: string;
  github_updated_at: string | null;
  tags: string[];
  categories: { category_id: string; category_name: string; is_primary: boolean }[];
  allCategories: string[];
  builders: {
    login: string;
    display_name: string | null;
    org_category: string | null;
    is_known_org: boolean;
  }[];
  ai_dev_skills: string[];
  pm_skills: string[];
  taxonomy: {
    dimension: string;
    value: string;
    similarityScore?: number | null;
    assignedBy?: string;
  }[];
  languages: { language: string; bytes: number; percentage: number }[];
  commits: {
    sha: string;
    message: string;
    author: string | null;
    committed_at: string;
    url: string | null;
  }[];
}

const TAXONOMY_DIMENSION_LABELS: Record<string, string> = {
  skill_area: 'Skill Areas',
  industry: 'Industries',
  use_case: 'Use Cases',
  modality: 'Modalities',
  ai_trend: 'AI Trends',
  deployment_context: 'Deployment Context',
  tags: 'Tags',
  maturity_level: 'Maturity Level',
};

const TAXONOMY_DIMENSION_STYLES: Record<string, string> = {
  skill_area: 'border-sky-700/30 bg-sky-900/30 text-sky-300',
  industry: 'border-amber-700/40 bg-amber-900/30 text-amber-300',
  use_case: 'border-fuchsia-700/40 bg-fuchsia-900/30 text-fuchsia-300',
  modality: 'border-teal-700/40 bg-teal-900/30 text-teal-300',
  ai_trend: 'border-cyan-700/40 bg-cyan-900/30 text-cyan-300',
  deployment_context: 'border-orange-700/40 bg-orange-900/30 text-orange-300',
  tags: 'border-zinc-700 bg-zinc-800/70 text-zinc-200',
  maturity_level: 'border-emerald-700/40 bg-emerald-900/30 text-emerald-300',
};

function formatRelativeDate(value: string | null): string {
  if (!value) return 'Unclear';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unclear';

  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 0) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function formatDate(value: string | null): string {
  if (!value) return 'Unclear';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unclear';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCount(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString();
}

function getCategoryMeta(name: string) {
  return CATEGORIES.find((category) => category.name === name) ?? null;
}

function groupSkills(skills: string[]) {
  const groups = new Map<string, string[]>();
  for (const skill of skills) {
    const group = SKILL_LIFECYCLE_GROUPS[skill] ?? 'Unmapped';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(skill);
  }
  return [...groups.entries()];
}

function groupTaxonomy(taxonomy: RepoDetail['taxonomy']) {
  const groups = new Map<string, RepoDetail['taxonomy']>();
  for (const entry of taxonomy ?? []) {
    if (!groups.has(entry.dimension)) groups.set(entry.dimension, []);
    groups.get(entry.dimension)!.push(entry);
  }
  return [...groups.entries()].sort((a, b) => {
    const aLabel = TAXONOMY_DIMENSION_LABELS[a[0]] ?? a[0];
    const bLabel = TAXONOMY_DIMENSION_LABELS[b[0]] ?? b[0];
    return aLabel.localeCompare(bLabel);
  });
}

async function getRepoDetail(name: string): Promise<RepoDetail | null> {
  try {
    const response = await fetch(`${API_URL}/repos/${encodeURIComponent(name)}`, {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`API error ${response.status}`);
    return (await response.json()) as RepoDetail;
  } catch {
    try {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'public', 'data', 'library.json'), 'utf-8')
      ) as { repos: EnrichedRepo[] };
      const repo = data.repos.find((item) => item.name === name);
      if (!repo) return null;

      return {
        id: String(repo.id),
        name: repo.name,
        owner: repo.fullName.split('/')[0] ?? 'unknown',
        description: repo.description,
        is_fork: repo.isFork,
        forked_from: repo.forkedFrom,
        primary_language: repo.language,
        github_url: repo.url,
        fork_sync_state: repo.forkSync?.state ?? null,
        behind_by: repo.forkSync?.behindBy ?? 0,
        ahead_by: repo.forkSync?.aheadBy ?? 0,
        upstream_created_at: repo.upstreamCreatedAt,
        forked_at: repo.forkedAt,
        your_last_push_at: repo.yourLastPushAt,
        upstream_last_push_at: repo.upstreamLastPushAt,
        parent_stars: repo.parentStats?.stars ?? repo.stars,
        parent_forks: repo.parentStats?.forks ?? repo.forks,
        parent_is_archived: repo.parentStats?.isArchived ?? repo.isArchived,
        stargazers_count: repo.stars,
        open_issues_count: (repo as EnrichedRepo & { openIssuesCount?: number }).openIssuesCount ?? repo.parentStats?.openIssues ?? 0,
        commits_last_7_days: repo.commitStats?.last7Days ?? 0,
        commits_last_30_days: repo.commitStats?.last30Days ?? 0,
        commits_last_90_days: repo.commitStats?.last90Days ?? 0,
        readme_summary: repo.readmeSummary,
        activity_score: 0,
        quality_signals: repo.qualitySignals ?? repo.quality_signals ?? null,
        ingested_at: repo.lastUpdated,
        updated_at: repo.lastUpdated,
        github_updated_at: repo.lastUpdated,
        tags: repo.enrichedTags ?? [],
        categories: (repo.allCategories ?? []).map((categoryName) => ({
          category_id: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          category_name: categoryName,
          is_primary: categoryName === repo.primaryCategory,
        })),
        allCategories: repo.allCategories ?? [],
        builders: (repo.builders ?? []).map((builder) => ({
          login: builder.login,
          display_name: builder.name,
          org_category: builder.orgCategory,
          is_known_org: builder.isKnownOrg,
        })),
        ai_dev_skills: (repo.aiDevSkills ?? []).map((skill) => skill.skill),
        pm_skills: repo.pmSkills ?? [],
        languages: Object.entries(repo.languagePercentages ?? {}).map(([language, percentage]) => ({
          language,
          bytes: repo.languageBreakdown?.[language] ?? 0,
          percentage,
        })),
        commits: (repo.recentCommits ?? []).map((commit) => ({
          sha: commit.sha,
          message: commit.message,
          author: commit.author,
          committed_at: commit.date,
          url: commit.url,
        })),
        taxonomy: repo.taxonomy ?? [],
      };
    } catch {
      return null;
    }
  }
}

async function getSimilarRepos(name: string): Promise<SimilarRepo[]> {
  try {
    const response = await fetch(`${API_URL}/repos/${encodeURIComponent(name)}/similar?limit=5`, {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    return (await response.json()) as SimilarRepo[];
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  try {
    const data = JSON.parse(
      readFileSync(join(process.cwd(), 'public', 'data', 'library.json'), 'utf-8')
    ) as { repos: Array<{ name: string }> };
    return data.repos.map((repo) => ({ name: repo.name }));
  } catch {
    return [];
  }
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-100">{value}</p>
      {note && <p className="mt-1 text-xs text-zinc-500">{note}</p>}
    </div>
  );
}

export default async function RepoDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const repo = await getRepoDetail(decodeURIComponent(name));
  if (!repo) notFound();
  const similarRepos = await getSimilarRepos(repo.name);

  const skillGroups = groupSkills(repo.ai_dev_skills ?? []);
  const taxonomyGroups = groupTaxonomy(repo.taxonomy ?? []);
  const stars = repo.is_fork ? repo.parent_stars : repo.stargazers_count;
  const forks = repo.is_fork ? repo.parent_forks : 0;
  const builder = repo.builders?.[0] ?? null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <WikiNavBar title={repo.name} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 md:px-8">
        <section className="rounded-[28px] border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-950 p-6 shadow-2xl shadow-black/25">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <Link href="/" className="hover:text-zinc-300 transition-colors">
                  Library
                </Link>
                <span>/</span>
                <span className="text-zinc-300">{repo.name}</span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${repo.is_fork ? 'bg-violet-900/50 text-violet-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
                  {repo.is_fork ? 'Forked' : 'Built'}
                </span>
                {repo.parent_is_archived && (
                  <span className="rounded-full bg-red-900/50 px-2 py-0.5 font-medium text-red-300">
                    Archived upstream
                  </span>
                )}
              </div>

              <div>
                <p className="text-sm text-zinc-500">{repo.owner}/{repo.name}</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {repo.name}
                </h1>
                {repo.description && (
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300 md:text-base">
                    {repo.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={repo.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-400"
                >
                  <span>View on GitHub</span>
                  <span>↗</span>
                </a>
                {repo.forked_from && (
                  <a
                    href={`https://github.com/${repo.forked_from}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                  >
                    <span>Upstream {repo.forked_from}</span>
                    <span>↗</span>
                  </a>
                )}
              </div>
            </div>

            <div className="w-full max-w-sm rounded-[24px] border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Builder</p>
              {builder ? (
                <div className="mt-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://github.com/${builder.login}.png?size=48`}
                    alt={builder.display_name ?? builder.login}
                    className="h-12 w-12 rounded-full border border-zinc-700"
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      {builder.display_name ?? builder.login}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {builder.login}
                      {builder.org_category ? ` • ${builder.org_category}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">Unclear</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Stars" value={formatCount(stars)} note={repo.is_fork ? 'Using upstream star count' : 'Repository stars'} />
          <StatCard label="Forks" value={formatCount(forks)} note={repo.is_fork ? 'Using upstream fork count' : 'Repository forks'} />
          <StatCard label="Open Issues" value={formatCount(repo.open_issues_count)} />
          <StatCard label="Activity Score" value={`${repo.activity_score}/100`} note={`${repo.commits_last_30_days} commits in 30d`} />
          <StatCard label="Created" value={formatDate(repo.upstream_created_at)} note={repo.upstream_created_at ? 'Project creation date' : 'Unclear in current API contract'} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
          <div className="space-y-6">
            <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-lg font-semibold text-zinc-100">README Summary</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                {repo.readme_summary ?? 'Unclear'}
              </p>
            </section>

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-lg font-semibold text-zinc-100">AI Dev Skills</h2>
              {skillGroups.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {skillGroups.map(([group, skills]) => (
                    <div key={group}>
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">{group}</p>
                      <div className="flex flex-wrap gap-2">
                        {skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full border border-sky-700/30 bg-sky-900/30 px-3 py-1 text-xs font-medium text-sky-300"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">No AI dev skills recorded.</p>
              )}
            </section>

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-lg font-semibold text-zinc-100">Tags</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(repo.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
                {(repo.tags ?? []).length === 0 && (
                  <p className="text-sm text-zinc-500">No tags recorded.</p>
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-lg font-semibold text-zinc-100">Taxonomy</h2>
              {taxonomyGroups.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {taxonomyGroups.map(([dimension, entries]) => (
                    <div key={dimension}>
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                        {TAXONOMY_DIMENSION_LABELS[dimension] ?? dimension.replace(/_/g, ' ')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {entries.map((entry) => (
                          <Link
                            key={`${entry.dimension}:${entry.value}`}
                            href={`/?taxonomyDimension=${encodeURIComponent(entry.dimension)}&taxonomyValue=${encodeURIComponent(entry.value)}`}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-zinc-500 hover:text-white ${TAXONOMY_DIMENSION_STYLES[dimension] ?? 'border-zinc-700 bg-zinc-800/70 text-zinc-200'}`}
                          >
                            <span>{entry.value}</span>
                            {typeof entry.similarityScore === 'number' ? (
                              <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em]">
                                {Math.round(entry.similarityScore * 100)}%
                              </span>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">No taxonomy dimensions recorded.</p>
              )}
            </section>

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-zinc-100">Recent Activity</h2>
                <p className="text-xs text-zinc-500">Updated {formatRelativeDate(repo.github_updated_at ?? repo.updated_at)}</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <StatCard label="7 Days" value={String(repo.commits_last_7_days)} />
                <StatCard label="30 Days" value={String(repo.commits_last_30_days)} />
                <StatCard label="90 Days" value={String(repo.commits_last_90_days)} />
              </div>
              {repo.commits.length > 0 && (
                <div className="mt-5 space-y-3">
                  {repo.commits.slice(0, 8).map((commit) => (
                    <a
                      key={commit.sha}
                      href={commit.url ?? repo.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 transition-colors hover:border-zinc-700"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-200">{commit.message}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {commit.author ?? 'Unknown author'} • {formatDate(commit.committed_at)}
                          </p>
                        </div>
                        <span className="text-xs text-zinc-600">{commit.sha.slice(0, 7)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-zinc-100">Quality</h2>
                <QualityBadge quality={repo.quality_signals} />
              </div>
              {repo.quality_signals ? (
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-zinc-500">Has tests</dt>
                    <dd className="text-zinc-200">{repo.quality_signals.has_tests ? 'Yes' : 'No'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-zinc-500">Has CI</dt>
                    <dd className="text-zinc-200">{repo.quality_signals.has_ci ? 'Yes' : 'No'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-zinc-500">Commit velocity (30d)</dt>
                    <dd className="text-zinc-200">{repo.quality_signals.commit_velocity_30d.toFixed(1)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-zinc-500">Overall score</dt>
                    <dd className="text-zinc-200">{Math.round(repo.quality_signals.overall_score)}/100</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">Quality signals are not available for this repo yet.</p>
              )}
            </section>

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-lg font-semibold text-zinc-100">Categories</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(repo.categories ?? []).map((category) => {
                  const meta = getCategoryMeta(category.category_name);
                  return (
                    <span
                      key={category.category_id}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                      style={{
                        borderColor: meta?.color ?? '#3f3f46',
                        backgroundColor: `${meta?.color ?? '#27272a'}1a`,
                        color: meta?.color ?? '#d4d4d8',
                      }}
                    >
                      {meta?.icon ? <span>{meta.icon}</span> : null}
                      <span>{category.category_name}</span>
                      {category.is_primary ? <span className="text-[10px] uppercase tracking-[0.16em] opacity-70">Primary</span> : null}
                    </span>
                  );
                })}
                {(repo.categories ?? []).length === 0 && (
                  <p className="text-sm text-zinc-500">No categories recorded.</p>
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-lg font-semibold text-zinc-100">PM Skills</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(repo.pm_skills ?? []).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-indigo-700/40 bg-indigo-900/30 px-3 py-1 text-xs font-medium text-indigo-300"
                  >
                    {skill}
                  </span>
                ))}
                {(repo.pm_skills ?? []).length === 0 && (
                  <p className="text-sm text-zinc-500">No PM skills recorded.</p>
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-lg font-semibold text-zinc-100">Languages</h2>
              <div className="mt-4 space-y-3">
                {(repo.languages ?? []).map((language) => (
                  <div key={language.language}>
                    <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
                      <span>{language.language}</span>
                      <span>{language.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800">
                      <div
                        className="h-2 rounded-full bg-sky-400"
                        style={{ width: `${Math.max(language.percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {(repo.languages ?? []).length === 0 && (
                  <p className="text-sm text-zinc-500">No language breakdown recorded.</p>
                )}
              </div>
            </section>

            {/* Dependencies — only rendered when taxonomy has `dependency` entries */}
            {(() => {
              const deps = (repo.taxonomy ?? []).filter((t) => t.dimension === 'dependency');
              if (deps.length === 0) return null;
              return (
                <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="text-lg font-semibold text-zinc-100">Dependencies</h2>
                    <span className="text-xs text-zinc-500">{deps.length} detected</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {deps.map((dep) => (
                      <span
                        key={dep.value}
                        className="rounded-full border border-violet-700/40 bg-violet-900/20 px-3 py-1 text-xs font-medium text-violet-300"
                      >
                        {dep.value}
                      </span>
                    ))}
                  </div>
                </section>
              );
            })()}

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-lg font-semibold text-zinc-100">Timeline</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500">Project created</dt>
                  <dd className="text-zinc-200">{formatDate(repo.upstream_created_at)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500">Forked</dt>
                  <dd className="text-zinc-200">{formatDate(repo.forked_at)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500">Your last push</dt>
                  <dd className="text-zinc-200">{formatRelativeDate(repo.your_last_push_at)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500">Upstream last push</dt>
                  <dd className="text-zinc-200">{formatRelativeDate(repo.upstream_last_push_at)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500">Tracked since</dt>
                  <dd className="text-zinc-200">{formatDate(repo.ingested_at)}</dd>
                </div>
              </dl>
            </section>
          </div>
        </section>

        <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">Similar Repos</h2>
            <p className="text-xs text-zinc-500">Cosine similarity from repo embeddings</p>
          </div>
          {similarRepos.length > 0 ? (
            <div className="mt-4 space-y-3">
              {similarRepos.map((similar) => (
                <Link
                  key={similar.name}
                  href={`/repo/${encodeURIComponent(similar.name)}`}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 transition-colors hover:border-zinc-700"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{similar.name}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                      {similar.description ?? 'No description available.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {similar.primary_language ? (
                      <span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 text-xs text-zinc-300">
                        {similar.primary_language}
                      </span>
                    ) : null}
                    {typeof similar.similarity === 'number' ? (
                      <span className="rounded-full border border-sky-700/30 bg-sky-900/30 px-2 py-0.5 text-xs font-medium text-sky-300">
                        {Math.round(similar.similarity * 100)}% match
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No similar repos surfaced yet.</p>
          )}
        </section>
      </main>
    </div>
  );
}
