'use client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { EnrichedRepo } from '@/types/repo';

interface RepoDetailPanelProps {
  repo: EnrichedRepo | null;
  relatedRepos: EnrichedRepo[];
  onClose: () => void;
  onOpenRepo: (name: string) => void;
}

const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 };

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const LIFE_STATUS_MAP: Record<string, { emoji: string; label: string; color: string }> = {
  active:   { emoji: '💚', label: 'Active',   color: '#4ade80' },
  hot:      { emoji: '🚀', label: 'Hot',      color: '#86efac' },
  stable:   { emoji: '💛', label: 'Stable',   color: '#fbbf24' },
  dormant:  { emoji: '🌙', label: 'Dormant',  color: '#a1a1aa' },
  inactive: { emoji: '💀', label: 'Inactive', color: '#52525b' },
  archived: { emoji: '📦', label: 'Archived', color: '#52525b' },
};

function getLifeLabel(repo: EnrichedRepo): { emoji: string; label: string; color: string } {
  const isArchived = repo.parentStats?.isArchived ?? repo.isArchived ?? false;
  if (isArchived) return LIFE_STATUS_MAP.archived;

  const c7  = Math.max(repo.commitStats?.last7Days ?? 0, repo.commitsLast7Days?.length ?? 0);
  const c30 = Math.max(repo.commitStats?.last30Days ?? 0, repo.commitsLast30Days?.length ?? 0);
  const c90 = Math.max(repo.commitStats?.last90Days ?? 0, repo.commitsLast90Days?.length ?? 0);
  const stars = repo.parentStats?.stars ?? repo.stars ?? 0;
  const daysSince = (Date.now() - new Date(repo.lastUpdated).getTime()) / 86400000;

  if (c7 >= 10 || c30 >= 30) return LIFE_STATUS_MAP.hot;
  if (c30 > 0) return LIFE_STATUS_MAP.active;
  if (c90 > 0 || daysSince < 90) return LIFE_STATUS_MAP.stable;
  if (stars > 500 || daysSince < 365) return LIFE_STATUS_MAP.dormant;
  return LIFE_STATUS_MAP.inactive;
}

export function RepoDetailPanel({ repo, relatedRepos, onClose, onOpenRepo }: RepoDetailPanelProps) {
  return (
    <AnimatePresence>
      {repo && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 30,
            }}
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={SPRING}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(420px, 92vw)',
              backgroundColor: '#18181b',
              borderLeft: '1px solid #27272a',
              zIndex: 40,
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '20px 20px 0',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    color: '#f4f4f5',
                    wordBreak: 'break-word',
                    marginBottom: 6,
                  }}
                >
                  {repo.name}
                </h2>
                {repo.dbCategory && (
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      color: '#c4b5fd',
                      backgroundColor: 'rgba(139,92,246,0.15)',
                      border: '1px solid rgba(139,92,246,0.3)',
                      borderRadius: '9999px',
                      padding: '2px 8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {repo.dbCategory}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: '0.375rem',
                  border: '1px solid #3f3f46',
                  backgroundColor: 'transparent',
                  color: '#71717a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                }}
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 20px', flex: 1 }}>
              {/* Description */}
              {repo.description && (
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: '#a1a1aa',
                    lineHeight: 1.6,
                    marginBottom: 16,
                  }}
                >
                  {repo.description}
                </p>
              )}

              {/* Stats row */}
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  marginBottom: 16,
                  flexWrap: 'wrap',
                }}
              >
                {(repo.parentStats?.stars ?? repo.stars ?? 0) > 0 && (
                  <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>
                    ★ {formatStars(repo.parentStats?.stars ?? repo.stars ?? 0)} stars
                  </span>
                )}
                {(repo.parentStats?.forks ?? repo.forks ?? 0) > 0 && (
                  <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>
                    ⑂ {repo.parentStats?.forks ?? repo.forks ?? 0} forks
                  </span>
                )}
                {repo.language && (
                  <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>
                    {repo.language}
                  </span>
                )}
                {(() => {
                  const life = getLifeLabel(repo);
                  return (
                    <span style={{ fontSize: '0.8125rem', color: life.color }}>
                      {life.emoji} {life.label}
                    </span>
                  );
                })()}
              </div>

              {/* Tags */}
              {repo.enrichedTags.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: '#52525b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 8,
                    }}
                  >
                    Tags
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {repo.enrichedTags.slice(0, 6).map(tag => (
                      <span
                        key={tag}
                        style={{
                          fontSize: '0.6875rem',
                          color: '#a1a1aa',
                          backgroundColor: 'rgba(63,63,70,0.5)',
                          border: '1px solid #3f3f46',
                          borderRadius: '9999px',
                          padding: '2px 8px',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Related repos */}
              {relatedRepos.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: '#52525b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 8,
                    }}
                  >
                    Related repos
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {relatedRepos.slice(0, 4).map(r => (
                      <button
                        key={r.name}
                        onClick={() => onOpenRepo(r.name)}
                        style={{
                          fontSize: '0.75rem',
                          color: '#c4b5fd',
                          backgroundColor: 'rgba(139,92,246,0.1)',
                          border: '1px solid rgba(139,92,246,0.25)',
                          borderRadius: '0.375rem',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          transition: 'background-color 150ms',
                        }}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '12px 20px 20px',
                borderTop: '1px solid #27272a',
              }}
            >
              <button
                onClick={() => onOpenRepo(repo.name)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: '#8b5cf6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 150ms',
                }}
              >
                Open full page →
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
