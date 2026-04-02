'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { EnrichedRepo } from '@/types/repo';

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

export function RepoCardMinimal({ repo, onSelect, isSelected, isRelated, anySelected }: RepoCardMinimalProps) {
  const [hovered, setHovered] = useState(false);

  const stars = repo.parentStats?.stars ?? repo.stars ?? 0;
  const displayTag = getDisplayTag(repo);

  // Determine opacity for dimming
  let opacity = 1;
  if (anySelected && !isSelected && !isRelated) {
    opacity = 0.4;
  }

  const borderColor = isSelected
    ? '#8b5cf6'
    : hovered
    ? 'rgba(139,92,246,0.5)'
    : '#27272a';

  const boxShadow = isSelected
    ? '0 0 0 1px #8b5cf6, 0 8px 24px rgba(139,92,246,0.25)'
    : hovered
    ? '0 0 0 1px rgba(139,92,246,0.3), 0 4px 12px rgba(0,0,0,0.4)'
    : '0 1px 2px rgba(0,0,0,0.3)';

  const bgColor = isSelected
    ? 'rgba(139,92,246,0.08)'
    : isRelated && anySelected
    ? 'rgba(139,92,246,0.04)'
    : '#18181b';

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
        boxShadow,
        backgroundColor: bgColor,
        cursor: 'pointer',
        padding: '12px 14px',
        transition: 'border-color 150ms ease-out, background-color 150ms ease-out, box-shadow 150ms ease-out',
      }}
    >
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
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
        {stars > 0 && (
          <span
            style={{
              fontSize: '0.6875rem',
              color: '#a1a1aa',
              whiteSpace: 'nowrap',
              paddingTop: 2,
              flexShrink: 0,
            }}
          >
            ★ {stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}
          </span>
        )}
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
