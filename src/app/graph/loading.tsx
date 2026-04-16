export default function GraphLoading() {
  return (
    <div className="relative h-[calc(100vh-80px)] w-full bg-zinc-950">
      {/* Animated orbit rings to signal that the heavy WebGL bundle is on its way */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-400">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 animate-spin rounded-full border border-purple-500/40 border-t-purple-400" />
          <div
            className="absolute inset-2 animate-spin rounded-full border border-fuchsia-500/30 border-t-fuchsia-400"
            style={{ animationDuration: '2.4s', animationDirection: 'reverse' }}
          />
          <div className="absolute inset-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
        </div>
        <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">
          Loading knowledge graph…
        </p>
        <p className="text-[11px] text-zinc-600">Building 3D scene · ~1,641 nodes</p>
      </div>
    </div>
  );
}
