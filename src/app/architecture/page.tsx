import type { Metadata } from 'next';
import { WikiNavBar } from '@/components/WikiNavBar';

export const metadata: Metadata = {
  title: 'Architecture',
  description:
    'How the Reporium suite works: the ingestion pipeline, FastAPI + pgvector backend, Next.js frontend, event bus, and Workato integrations.',
  openGraph: {
    title: 'Architecture',
    description:
      'How the Reporium suite works: the ingestion pipeline, FastAPI + pgvector backend, Next.js frontend, event bus, and Workato integrations.',
    url: 'https://www.reporium.com/architecture',
  },
  twitter: {
    title: 'Architecture',
    description:
      'How the Reporium suite works: the ingestion pipeline, FastAPI + pgvector backend, Next.js frontend, event bus, and Workato integrations.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Data model for the diagram
// ─────────────────────────────────────────────────────────────────────────────

type ComponentCard = {
  id: string;
  name: string;
  repo: string;
  runtime: string;
  role: string;
  tech: string[];
  accent: 'purple' | 'emerald' | 'sky' | 'amber' | 'fuchsia' | 'rose' | 'teal';
};

const CLIENT_LAYER: ComponentCard[] = [
  {
    id: 'frontend',
    name: 'Reporium Web',
    repo: 'reporium',
    runtime: 'Next.js 16 · static export · Vercel edge',
    role: 'User-facing UI: search, graph, wiki, repo detail, ask bar.',
    tech: ['React 19', 'Tailwind', 'three.js', 'd3-force-3d'],
    accent: 'purple',
  },
  {
    id: 'workato',
    name: 'Workato Recipes',
    repo: 'Workato cloud',
    runtime: '3 recipes (nightly + 2 × realtime)',
    role: 'Cross-system automation: SLO alerts → JIRA, ask → JIRA loop, weekly digest.',
    tech: ['HTTP polling', 'JIRA', 'Discord', 'Anthropic'],
    accent: 'fuchsia',
  },
];

const API_LAYER: ComponentCard[] = [
  {
    id: 'api',
    name: 'reporium-api',
    repo: 'reporium-api',
    runtime: 'FastAPI · Cloud Run (us-central1) · f1-micro tier',
    role: 'Public HTTPS surface. Handles /ask, /repos, /graph, /admin/*. Rate-limited, Sentry-instrumented.',
    tech: ['FastAPI', 'asyncpg', 'pgvector', 'SlowAPI', 'Sentry'],
    accent: 'emerald',
  },
  {
    id: 'events',
    name: 'reporium-events',
    repo: 'reporium-events',
    runtime: 'Python library — published by writers, subscribed by readers',
    role: '8 typed event types on Pub/Sub so services stay loosely coupled (repo.ingested, ask.answered, fork.synced…).',
    tech: ['GCP Pub/Sub', 'pydantic'],
    accent: 'sky',
  },
];

const DATA_LAYER: ComponentCard[] = [
  {
    id: 'ingestion',
    name: 'reporium-ingestion',
    repo: 'reporium-ingestion',
    runtime: 'Python · Cloud Run Job · nightly (VPC direct-egress)',
    role: 'Pulls 1,641 repos from GitHub, enriches tags + pros/cons, rebuilds knowledge graph atomically.',
    tech: ['httpx', 'Anthropic', 'psycopg2', 'atomic_swap'],
    accent: 'amber',
  },
  {
    id: 'forksync',
    name: 'forksync',
    repo: 'forksync',
    runtime: 'Cloud Run Job · hourly',
    role: 'Keeps 1,390 forks aligned with their upstreams; publishes fork.synced events.',
    tech: ['gh CLI', 'events lib'],
    accent: 'teal',
  },
  {
    id: 'db',
    name: 'Postgres + pgvector',
    repo: 'reporium-db',
    runtime: 'Cloud SQL (f1-micro) · managed backups · Alembic',
    role: 'Source of truth. Stores repos, dependencies, graph edges, query_log, and vector embeddings.',
    tech: ['PostgreSQL 16', 'pgvector', '036 migrations'],
    accent: 'rose',
  },
  {
    id: 'metrics',
    name: 'reporium-metrics',
    repo: 'reporium-metrics',
    runtime: 'Cron-scheduled collector',
    role: 'Aggregates ask latency, graph drift, ingest cost — feeds the insights dashboards and Workato alerts.',
    tech: ['psycopg2', 'pandas'],
    accent: 'sky',
  },
];

const ACCENT_CLASSES: Record<ComponentCard['accent'], { border: string; chip: string; text: string }> = {
  purple:  { border: 'border-purple-500/40',  chip: 'bg-purple-500/10 text-purple-300 border border-purple-500/30',  text: 'text-purple-200'  },
  emerald: { border: 'border-emerald-500/40', chip: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30', text: 'text-emerald-200' },
  sky:     { border: 'border-sky-500/40',     chip: 'bg-sky-500/10 text-sky-300 border border-sky-500/30',         text: 'text-sky-200'     },
  amber:   { border: 'border-amber-500/40',   chip: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',     text: 'text-amber-200'   },
  fuchsia: { border: 'border-fuchsia-500/40', chip: 'bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/30', text: 'text-fuchsia-200' },
  rose:    { border: 'border-rose-500/40',    chip: 'bg-rose-500/10 text-rose-300 border border-rose-500/30',       text: 'text-rose-200'    },
  teal:    { border: 'border-teal-500/40',    chip: 'bg-teal-500/10 text-teal-300 border border-teal-500/30',       text: 'text-teal-200'    },
};

function Card({ c }: { c: ComponentCard }) {
  const a = ACCENT_CLASSES[c.accent];
  return (
    <div
      className={`relative rounded-2xl border ${a.border} bg-zinc-900/70 p-4 shadow-lg shadow-black/20 backdrop-blur-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className={`text-sm font-semibold ${a.text}`}>{c.name}</h3>
          <p className="mt-0.5 text-[11px] font-mono text-zinc-500">{c.repo}</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">{c.runtime}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-300">{c.role}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {c.tech.map((t) => (
          <span key={t} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${a.chip}`}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function LayerHeading({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">{title}</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>
      </div>
      <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] font-mono text-zinc-500">
        {badge}
      </span>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-2" aria-hidden>
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-600">
        <span className="h-px w-10 bg-zinc-800" />
        <span>{label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      </div>
    </div>
  );
}

const ASK_FLOW = [
  { step: 'Browser', detail: 'User types a question in the sticky ask bar.' },
  { step: 'POST /ask', detail: 'Rate-limited (6/min/IP), auth via Bearer token.' },
  { step: 'Router', detail: 'Route classifier picks Haiku ($0.002/ask) vs Sonnet ($0.05/ask) based on intent.' },
  { step: 'pgvector retrieval', detail: 'Top-K repos matched on embedded tags + descriptions.' },
  { step: 'Anthropic stream', detail: 'Claude composes an answer with citations.' },
  { step: 'query_log', detail: 'Every ask persisted — cost, latency, sentiment — for the Workato loop.' },
];

const INGEST_FLOW = [
  { step: 'Cloud Run Job', detail: 'Nightly cron triggers ingestion (VPC direct-egress).' },
  { step: 'GitHub REST', detail: 'Lists all 1,641 repos; pulls pushed_at, topics, README, dependencies.' },
  { step: 'Enrichment', detail: 'Tagger assigns 16 fixed categories; Claude summarizes READMEs.' },
  { step: 'Atomic graph rebuild', detail: 'New edges land in a staging table; >50% drop aborts the swap.' },
  { step: 'POST /ingest', detail: 'API upserts repos; emits repo.ingested events.' },
  { step: 'Vector refresh', detail: 'New embeddings written to pgvector; static JSON regenerated for the SEO export.' },
];

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <WikiNavBar title="Architecture" />

      <main className="mx-auto w-full max-w-6xl space-y-10 px-5 py-8 md:px-8">
        {/* Hero */}
        <header className="space-y-3">
          <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-zinc-500">
            Reporium Suite · 2026-04-15
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">
            Architecture at a glance
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">
            Reporium is eight loosely-coupled services on a $0-budget GCP footprint. The frontend ships as a
            static export to Vercel; every other service runs on Cloud Run with scale-to-zero. The event bus keeps
            data flowing without anyone needing to know about anyone else.
          </p>
        </header>

        {/* Stack facts */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { k: 'Repos indexed', v: '1,641' },
            { k: 'Graph edges', v: '4 types' },
            { k: 'Ask P50 latency', v: '~600 ms' },
            { k: 'Monthly infra', v: '$0' },
          ].map((s) => (
            <div
              key={s.k}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-center"
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{s.k}</p>
              <p className="mt-1 text-xl font-semibold text-zinc-100">{s.v}</p>
            </div>
          ))}
        </section>

        {/* Component diagram — three layers */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Component map</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Three layers, top to bottom: what the user touches, what answers them, and what remembers.
            </p>
          </div>

          {/* Client layer */}
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/30 p-5">
            <LayerHeading
              title="Client & automation"
              subtitle="Anything that initiates a conversation with the system"
              badge="layer 1 · edge"
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {CLIENT_LAYER.map((c) => (
                <Card key={c.id} c={c} />
              ))}
            </div>
          </div>

          <FlowArrow label="HTTPS · signed JWT" />

          {/* API layer */}
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/30 p-5">
            <LayerHeading
              title="API & event bus"
              subtitle="The narrow waist — every ask, every event flows here"
              badge="layer 2 · request plane"
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {API_LAYER.map((c) => (
                <Card key={c.id} c={c} />
              ))}
            </div>
          </div>

          <FlowArrow label="asyncpg · Pub/Sub" />

          {/* Data layer */}
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/30 p-5">
            <LayerHeading
              title="Data & workers"
              subtitle="The things that write the state that everything else reads"
              badge="layer 3 · truth"
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {DATA_LAYER.map((c) => (
                <Card key={c.id} c={c} />
              ))}
            </div>
          </div>
        </section>

        {/* Ask flow */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">What happens when you ask something</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Six hops from keystroke to answer. Every one is logged to <code className="rounded bg-zinc-800 px-1 font-mono text-[11px]">query_log</code> so
              the Workato recipe can open a JIRA ticket on frustrated asks.
            </p>
          </div>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {ASK_FLOW.map((s, i) => (
              <li
                key={s.step}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-zinc-500">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="text-sm font-semibold text-zinc-100">{s.step}</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{s.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Ingest flow */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">What happens overnight</h2>
            <p className="mt-1 text-sm text-zinc-500">
              The nightly ingest is atomic: if edge counts drop &gt;50%, the staging swap aborts and last night&apos;s
              graph stays live. Zero-downtime, zero-foot-shot.
            </p>
          </div>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {INGEST_FLOW.map((s, i) => (
              <li
                key={s.step}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-zinc-500">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="text-sm font-semibold text-zinc-100">{s.step}</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{s.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Design principles */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Why it&apos;s shaped this way</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              {
                title: '$0/month infra budget',
                body: 'Static export → Vercel free tier. Cloud Run scale-to-zero with cron pings instead of min-instances. Cloud SQL f1-micro (pool_size=5+2) handles the whole app.',
              },
              {
                title: 'Additive, reversible data',
                body: 'Enrichments never DELETE before the replacement is verified. The graph rebuild uses a staging table + swap so a bad run can&apos;t blow up production.',
              },
              {
                title: 'Tiered model costs',
                body: 'Router picks Haiku ($0.002/ask) for simple lookups and Sonnet ($0.05/ask) only when reasoning is needed. Every ask is costed and logged.',
              },
              {
                title: 'Event-driven, not RPC-tangled',
                body: 'Services publish typed events (8 types today). New consumers subscribe without anyone knowing they exist. Loose coupling keeps the blast radius small.',
              },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"
              >
                <h3 className="text-sm font-semibold text-zinc-100">{p.title}</h3>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-zinc-800 pt-6 text-[11px] text-zinc-600">
          Source of truth: each repo&apos;s{' '}
          <code className="rounded bg-zinc-800 px-1 font-mono">CLAUDE.md</code> and{' '}
          <code className="rounded bg-zinc-800 px-1 font-mono">migrations/</code> folder. Last deploy: nightly.
        </footer>
      </main>
    </div>
  );
}
