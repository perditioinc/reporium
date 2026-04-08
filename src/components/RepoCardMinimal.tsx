'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { EnrichedRepo } from '@/types/repo';
import { getCategoryColor } from '@/lib/categoryColors';

interface RepoCardMinimalProps {
  repo: EnrichedRepo;
  onSelect: (name: string) => void;
  isSelected: boolean;
  isRelated: boolean;
  anySelected: boolean; // true when ANY card is selected (to know whether to dim)
}

const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 };

function getDisplayTag(repo: EnrichedRepo): string | null {
  const SYSTEM_TAGS = new Set(['Active', 'Forked', 'Built by Me', 'Inactive', 'Archived', 'Popular']);
  const contentTag = repo.enrichedTags.find(t => !SYSTEM_TAGS.has(t));
  return contentTag ?? repo.dbCategory ?? null;
}

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function getBuilder(repo: EnrichedRepo): string {
  if (repo.isFork && repo.parentStats?.owner) return repo.parentStats.owner;
  return repo.fullName.split('/')[0];
}

export function RepoCardMinimal({ repo, onSelect, isSelected, isRelated, anySelected }: RepoCardMinimalProps) {
  const [hovered, setHovered] = useState(false);

  const stars = repo.parentStats?.stars ?? repo.stars ?? 0;
  const forks = repo.parentStats?.forks ?? repo.forks ?? 0;
  const displayTag = getDisplayTag(repo);
  const builder = getBuilder(repo);
  const catColor = getCategoryColor(repo.dbCategory);

  // Determine opacity for dimming
  let opacity = 1;
  if (anySelected && !isSelected && !isRelated) {
    opacity = 0.4;
  }

  const borderColor = isSelected
    ? '#8b5cf6'
    : hovered
    ? `${catColor}80`
    : 'rgba(255,255,255,0.10)';

  const topBorderColor = isSelected ? '#8b5cf6' : catColor;

  const boxShadow = isSelected
    ? `0 0 0 1px #8b5cf6, 0 8px 24px rgba(139,92,246,0.25)`
    : hovered
    ? `0 4px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)`
    : '0 2px 8px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.07)';

  const bgColor = isSelected
    ? 'rgba(139,92,246,0.10)'
    : isRelated && anySelected
    ? 'rgba(139,92,246,0.05)'
    : 'rgba(255,255,255,0.03)';

  return (
    <motion.div
      layout
      animate={{ opacity }}
      transition={SPRING}
      whileHover={{ y: -2, scale: 1.01 }}
      onClick={() => onSelect(repo.name)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        borderRadius: '0.5rem',
        border: `1px solid ${borderColor}`,
        borderTop: `3px solid ${topBorderColor}`,
        boxShadow,
        backgroundColor: bgColor,
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        cursor: 'pointer',
        padding: '10px 14px 12px',
        transition: 'border-color 150ms ease-out, background-color 150ms ease-out, box-shadow 150ms ease-out',
        position: 'relative' as const,
      }}
    >
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            backgroundColor: topBorderColor, opacity: 0.85, flexShrink: 0,
          }} />
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: isSelected ? '#c4b5fd' : '#f4f4f5',
              lineHeight: 1.3,
              wordBreak: 'break-word',
            }}
          >
            {repo.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
          {stars > 0 && (
            <span style={{ fontSize: '0.6875rem', color: '#a1a1aa', whiteSpace: 'nowrap' }}>
              ★ {formatNum(stars)}
            </span>
          )}
          {forks > 0 && (
            <span style={{ fontSize: '0.6875rem', color: '#71717a', whiteSpace: 'nowrap' }}>
              ⑂ {formatNum(forks)}
            </span>
          )}
        </div>
      </div>

      {/* Builder */}
      <div style={{ marginTop: 3, fontSize: '0.625rem', color: '#52525b' }}>
        {builder}
      </div>

      {/* Tag badge */}
      {displayTag && (
        <div style={{ marginTop: 6 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: '0.625rem',
              fontWeight: 500,
              color: '#a1a1aa',
              backgroundColor: 'rgba(63,63,70,0.6)',
              border: '1px solid #3f3f46',
              borderRadius: '9999px',
              padding: '1px 7px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayTag}
          </span>
        </div>
      )}

      {/* Description — reveals on hover */}
      <motion.div
        animate={{ height: hovered ? 'auto' : 0, opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{ overflow: 'hidden' }}
      >
        {repo.description && (
          <p
            style={{
              marginTop: 8,
              fontSize: '0.75rem',
              color: '#71717a',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }}
          >
            {repo.description}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
