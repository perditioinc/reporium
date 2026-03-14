import { readFileSync } from 'fs';
import { join } from 'path';
import { WikiNavBar } from '@/components/WikiNavBar';

function getDigest(): string | null {
  try { return readFileSync(join(process.cwd(), 'DIGEST.md'), 'utf-8'); }
  catch { return null; }
}

export default function DigestPage() {
  const content = getDigest();
  if (!content) return (
    <div>
      <WikiNavBar title="Daily Digest" />
      <div className="p-8 text-zinc-400">
        No digest found. Run <code className="bg-zinc-800 px-1 rounded">npm run digest</code> to generate it.
      </div>
    </div>
  );

  // Simple markdown-to-HTML conversion for display
  const lines = content.split('\n');
  const rendered = lines.map((line, i) => {
    if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold text-zinc-100 mb-2">{line.slice(2)}</h1>;
    if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold text-zinc-200 mt-6 mb-2">{line.slice(3)}</h2>;
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-zinc-200">{line.slice(2, -2)}</p>;
    if (line.startsWith('- ')) return <li key={i} className="text-sm text-zinc-400 ml-4">{line.slice(2)}</li>;
    if (line.startsWith('---')) return <hr key={i} className="border-zinc-800 my-4" />;
    if (line.trim() === '') return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm text-zinc-400">{line}</p>;
  });

  return (
    <div>
      <WikiNavBar title="Daily Digest" />
      <div className="p-8 max-w-3xl mx-auto">
        <div className="space-y-1">{rendered}</div>
      </div>
    </div>
  );
}
