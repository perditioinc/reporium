import { ImageResponse } from 'next/og';
import { REPOS_INDEXED_LABEL } from '@/lib/corpusConstants.generated';

export const dynamic = 'force-static';

function roundDownTo100(countStr: string): string {
  const count = parseInt(countStr.replace(/,/g, ''), 10);
  const rounded = Math.floor(count / 100) * 100;
  return rounded.toLocaleString();
}

export default function Image() {
  const reposRounded = roundDownTo100(REPOS_INDEXED_LABEL);

  return new ImageResponse(
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#09090b',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      color: '#f4f4f5',
      padding: '40px',
      boxSizing: 'border-box' as const,
    }}>
      <p style={{ fontSize: '80px', fontWeight: 900, margin: 0, marginBottom: '20px' }}>
        Reporium
      </p>
      <p style={{ fontSize: '44px', fontWeight: 500, color: '#a1a1a6', margin: 0 }}>
        {reposRounded}+ AI dev tools
      </p>
    </div>,
    {
      width: 1200,
      height: 630,
    }
  );
}

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export const alt = 'Reporium — AI dev tools directory';
