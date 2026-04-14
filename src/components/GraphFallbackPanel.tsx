interface GraphFallbackPanelProps {
  title?: string;
  message: string;
  detail?: string | null;
  height?: number;
  compact?: boolean;
  actionHref?: string;
  actionLabel?: string;
}

export function GraphFallbackPanel({
  title = 'Knowledge graph preview unavailable',
  message,
  detail,
  height = 420,
  compact = false,
  actionHref = '/graph/',
  actionLabel = 'Open full graph',
}: GraphFallbackPanelProps) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-zinc-800 bg-[#0a0a0f] p-6"
      style={{ minHeight: `${height}px` }}
    >
      <div className={`w-full ${compact ? 'max-w-lg' : 'max-w-2xl'} text-center`}>
        <p className="text-sm font-semibold text-zinc-200">{title}</p>
        <p className="mt-2 text-sm text-zinc-400">{message}</p>
        {detail ? <p className="mt-2 text-xs text-zinc-500">{detail}</p> : null}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a
            href={actionHref}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-700"
          >
            {actionLabel}
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
