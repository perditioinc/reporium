import { ImageResponse } from 'next/og';
import { REPOS_INDEXED_LABEL } from '@/lib/corpusConstants.generated';

export const dynamic = 'force-static';

// Parse the repos indexed count and round down to nearest 100
function roundDownTo100(countStr: string): string {
  const count = parseInt(countStr.replace(/,/g, ''), 10);
  const rounded = Math.floor(count / 100) * 100;
  return rounded.toLocaleString();
}

export default function Image() {
  const reposRounded = roundDownTo100(REPOS_INDEXED_LABEL);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b', // zinc-950
          color: '#f4f4f5', // zinc-100
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '40px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: '80px',
            fontWeight: 'bold',
            marginBottom: '20px',
            letterSpacing: '-2px',
          }}
        >
          Reporium
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: '44px',
            fontWeight: '500',
            color: '#a1a1a6', // zinc-400
            lineHeight: '1.4',
          }}
        >
          {reposRounded}+ AI dev tools
        </div>
      </div>
    ),
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
