import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Reporium — AI Dev Tool Library';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #09090b 0%, #18181b 60%, #0f172a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Logo / brand mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
            }}
          >
            ✦
          </div>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#f4f4f5' }}>
            Reporium
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: '64px',
            fontWeight: 800,
            color: '#f9fafb',
            lineHeight: 1.1,
            margin: '0 0 24px 0',
            maxWidth: '900px',
          }}
        >
          AI Dev Tool Library
        </h1>

        {/* Subline */}
        <p
          style={{
            fontSize: '28px',
            color: '#a1a1aa',
            margin: '0 0 48px 0',
            maxWidth: '800px',
            lineHeight: 1.4,
          }}
        >
          1,500+ curated AI repos · semantic search · knowledge graph
        </p>

        {/* Tags row */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {['RAG', 'Agents', 'Fine-tuning', 'Observability', 'MLOps'].map((tag) => (
            <span
              key={tag}
              style={{
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.4)',
                color: '#a5b4fc',
                borderRadius: '999px',
                padding: '8px 20px',
                fontSize: '20px',
                fontWeight: 500,
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* URL badge */}
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            right: '80px',
            color: '#52525b',
            fontSize: '20px',
          }}
        >
          reporium.com
        </div>
      </div>
    ),
    { ...size }
  );
}
