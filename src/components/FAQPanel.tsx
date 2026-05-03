'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

// Pure renderer over public/data/faq.json (built by scripts/build-faq.ts at refresh
// time). No live API calls, no rate-limit machinery, no per-visitor token spend.

interface SourceRepo {
  name: string;
  owner: string;
  forked_from: string | null;
  description: string | null;
  stars: number | null;
  relevance_score: number;
  problem_solved: string | null;
  integration_tags: string[];
}

interface FAQAnswer {
  answer: string;
  sources: SourceRepo[];
  model: string;
  generatedAt: string;
}

interface FAQError {
  error: string;
  generatedAt: string;
}

type FAQEntry = FAQAnswer | FAQError;

interface FAQSection {
  title: string;
  blurb: string;
  questions: string[];
}

interface FAQData {
  generatedAt: string;
  sections: FAQSection[];
  answers: Record<string, FAQEntry>;
}

const MARKDOWN_COMPONENTS = {
  a: (props: React.ComponentProps<'a'>) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-zinc-200 underline underline-offset-2 hover:text-white"
    />
  ),
  code: (props: React.ComponentProps<'code'>) => (
    <code {...props} className="rounded bg-zinc-800 px-1 py-0.5 text-xs" />
  ),
  pre: (props: React.ComponentProps<'pre'>) => (
    <pre {...props} className="rounded-lg bg-zinc-900 p-3 overflow-x-auto my-2 text-xs" />
  ),
  ul: (props: React.ComponentProps<'ul'>) => (
    <ul {...props} className="list-disc pl-5 space-y-1 my-2" />
  ),
  ol: (props: React.ComponentProps<'ol'>) => (
    <ol {...props} className="list-decimal pl-5 space-y-1 my-2" />
  ),
  p: (props: React.ComponentProps<'p'>) => (
    <p {...props} className="my-2 first:mt-0 last:mb-0" />
  ),
};

function formatRepoLink(src: SourceRepo) {
  if (src.forked_from) {
    return { label: src.forked_from, href: `https://github.com/${src.forked_from}` };
  }
  const slug = `${src.owner}/${src.name}`;
  return { label: slug, href: `https://github.com/${slug}` };
}

function isAnswer(e: FAQEntry | undefined): e is FAQAnswer {
  return !!e && 'answer' in e;
}

// KAN-183: render-on-demand for FAQ markdown bodies.
//
// Why: with ~100 questions, mounting <ReactMarkdown> for every entry up-front
// (even inside a collapsed <details>) blows the main-thread budget. Mobile
// Lighthouse measured TBT=342ms / main-thread-work=2.2s on this page. The
// <details> element only hides the body visually; React still renders all
// children regardless of open state.
//
// Fix: track the open state per card via the native <details> onToggle event,
// and ONLY mount <ReactMarkdown> once the user expands the card. Once mounted,
// keep it mounted ('renderedOnce') so re-collapsing+re-expanding is instant
// and the prose state (e.g. text selection) survives a toggle.
//
// SEO note: this is a 'use client' component that fetches /data/faq.json on
// mount, so the answer body is never in the SSR HTML in the first place. The
// question text (the SEO-relevant part) remains in the rendered <summary>.
// Deferring the markdown render does not change the SSR output.
function FAQCard({ question, entry }: { question: string; entry: FAQEntry | undefined }) {
  const [renderedOnce, setRenderedOnce] = useState(false);

  return (
    <details
      className="group rounded-lg border border-zinc-800 bg-zinc-900/60 open:bg-zinc-900 transition-colors"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) {
          setRenderedOnce(true);
        }
      }}
    >
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-100">{question}</span>
        <span
          aria-hidden
          className="text-zinc-500 group-open:rotate-180 transition-transform text-xs shrink-0"
        >
          ▾
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-zinc-800/60">
        {!entry && (
          <p className="py-2 text-xs text-zinc-500">Answer unavailable for this question.</p>
        )}
        {entry && !isAnswer(entry) && (
          <p className="py-2 text-xs text-red-400">Answer unavailable ({entry.error}).</p>
        )}
        {isAnswer(entry) && (
          <div className="space-y-3">
            <div className="prose prose-invert prose-sm max-w-none text-sm text-zinc-200">
              {renderedOnce ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                  components={MARKDOWN_COMPONENTS}
                >
                  {entry.answer}
                </ReactMarkdown>
              ) : null}
            </div>
            {entry.sources.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1.5">
                  Sources
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {entry.sources.slice(0, 8).map((src) => {
                    const link = formatRepoLink(src);
                    return (
                      <li key={`${src.owner}/${src.name}`}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
                        >
                          {link.label}
                          {typeof src.stars === 'number' && (
                            <span className="text-zinc-500">★ {src.stars.toLocaleString()}</span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <a
              href={`/ask?q=${encodeURIComponent(question)}`}
              className="inline-block text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
            >
              Open in Ask →
            </a>
          </div>
        )}
      </div>
    </details>
  );
}

function FAQSkeleton() {
  return (
    <div className="space-y-2 py-2" aria-hidden>
      <div className="h-3 w-3/4 rounded bg-zinc-800 animate-pulse" />
      <div className="h-3 w-5/6 rounded bg-zinc-800 animate-pulse" />
      <div className="h-3 w-2/3 rounded bg-zinc-800 animate-pulse" />
    </div>
  );
}

export function FAQPanel() {
  const [data, setData] = useState<FAQData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Default cache (respect Cache-Control + revalidate via ETag) is what we want.
    // 'force-cache' would hold the browser's cached response for the full max-age
    // (3600s) without revalidation, so visitors would see a stale tree for an hour
    // after each refresh-data.yml run. The CDN already handles efficiency upstream.
    fetch('/data/faq.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: FAQData) => {
        if (!cancelled) setData(j);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(String(err?.message ?? err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = useMemo(
    () => (data?.sections ?? []).reduce((acc, s) => acc + s.questions.length, 0),
    [data],
  );

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-4">
        <p className="text-sm text-red-300">FAQ data is unavailable ({loadError}).</p>
        <p className="mt-1 text-xs text-zinc-500">
          Try refreshing the page, or use the Ask bar directly.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <FAQSkeleton />
        <FAQSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <p className="text-xs text-zinc-500">
        {total} questions · pre-computed at refresh time from{' '}
        <code className="bg-zinc-800 px-1 rounded">/intelligence/ask</code>. Click any
        question for the full answer with sources.
      </p>
      {data.sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-lg font-semibold text-zinc-200">{section.title}</h2>
          <p className="mt-1 text-xs text-zinc-500">{section.blurb}</p>
          <div className="mt-4 space-y-2">
            {section.questions.map((q) => (
              <FAQCard key={q} question={q} entry={data.answers[q]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
