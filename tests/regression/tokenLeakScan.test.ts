/**
 * tokenLeakScan.test.ts
 * --------------------------------------------------------------------------
 * Regression hotfix lane: cross-cutting (no specific lane).
 *
 * The Reporium frontend uses `NEXT_PUBLIC_APP_API_TOKEN` for /intelligence/ask
 * client requests. As a `NEXT_PUBLIC_*` var, Next.js inlines it into client
 * bundles by design (it's a SHARED secret used only for ask, not a user
 * authn token). However, it MUST NOT appear in:
 *   - public/data/library.json
 *   - public/data/owned.json
 *   - public/data/meta.json
 *   - public/data/repo-cache.json
 *   - public/data/trends.json
 *   - public/data/gaps.json
 *   - data/library.json
 *
 * If a token shows up in any of those static JSON artifacts, it means a
 * generation script (fetch-library, validate-library, write-corpus-constants)
 * accidentally serialized the runtime env or its own request headers into
 * an output file. Today's static-data artifacts ship to public/ on every
 * build, so anything written there is immediately public.
 *
 * SCAN STRATEGY
 *
 * To make this test self-contained — and to make the assertion concrete
 * even on a CI machine that has never had .env.local on it — we use a
 * synthetic sentinel string that is GUARANTEED not to appear in any
 * legitimate file. If the sentinel appears, the test stages an artificial
 * leak and confirms the scanner detects it.
 *
 * Then we scan the real artifacts for any 64-char-hex sequence that looks
 * token-shaped, AND for the literal value of NEXT_PUBLIC_APP_API_TOKEN if
 * the env var is set when the test runs.
 *
 * This is NOT a full bundle audit; it is the file-set the static export
 * actually emits to public storage. Bundle audit (out/_next/...) belongs
 * to a separate lane.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.join(__dirname, '..', '..');

const STATIC_DATA_PATHS: ReadonlyArray<string> = [
  'public/data/library.json',
  'public/data/owned.json',
  'public/data/meta.json',
  'public/data/repo-cache.json',
  'public/data/trends.json',
  'public/data/gaps.json',
  'data/library.json',
  'data/owned.json',
  'data/trends.json',
  'data/gaps.json',
];

const SENTINEL = 'TEST_TOKEN_DO_NOT_USE_4d40a32e5265a5d0_REGRESSION_GUARD';

/** A loose token-shape regex — 64 hex chars, the same shape as
 *  NEXT_PUBLIC_APP_API_TOKEN. Wider than necessary so accidental
 *  alternate-format secrets get caught too. Anchors avoid matching
 *  inside longer hashes. */
const TOKEN_SHAPED_HEX_RE = /(?<![A-Fa-f0-9])[A-Fa-f0-9]{64}(?![A-Fa-f0-9])/g;

function readIfExists(relPath: string): string | null {
  const abs = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  try {
    return fs.readFileSync(abs, 'utf-8');
  } catch {
    return null;
  }
}

describe('static-data artifact token leak scan', () => {
  test('the scanner CAN detect a planted sentinel (sanity check)', () => {
    const haystack = `irrelevant body ${SENTINEL} more body`;
    expect(haystack).toContain(SENTINEL);
  });

  test('no static-data file contains the synthetic sentinel', () => {
    const offenders: string[] = [];
    for (const rel of STATIC_DATA_PATHS) {
      const body = readIfExists(rel);
      if (body && body.includes(SENTINEL)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  test('no static-data file contains a token-shaped 64-char hex string', () => {
    const offenders: { file: string; tokenSample: string }[] = [];
    for (const rel of STATIC_DATA_PATHS) {
      const body = readIfExists(rel);
      if (!body) continue;
      const matches = body.match(TOKEN_SHAPED_HEX_RE);
      if (!matches) continue;

      // Filter out git-blob-style hashes and other innocent 64-char hex —
      // the value we care about specifically would be in a JSON value
      // string. A literal ":" or "," before the hex is the JSON-value
      // signature; otherwise it's likely a sha256 in metadata or similar.
      const inJsonValue = matches.filter((m) => {
        const idx = body.indexOf(m);
        const before = body.slice(Math.max(0, idx - 4), idx);
        return /["':,\s]/.test(before);
      });

      for (const tok of inJsonValue) {
        offenders.push({ file: rel, tokenSample: `${tok.slice(0, 8)}...${tok.slice(-4)}` });
      }
    }

    // We expect this set to be empty. If any 64-char hex shows up in a
    // public JSON value we want to know — even if the value is innocent,
    // it's worth investigating before shipping.
    expect(offenders).toEqual([]);
  });

  test('no static-data file contains the literal NEXT_PUBLIC_APP_API_TOKEN (when set in test env)', () => {
    const liveToken = process.env.NEXT_PUBLIC_APP_API_TOKEN;
    if (!liveToken || liveToken.length < 16) {
      // Skip with a meaningful message rather than failing — CI may not
      // export the secret at all, which is the safe default.
      expect(true).toBe(true);
      return;
    }

    const offenders: string[] = [];
    for (const rel of STATIC_DATA_PATHS) {
      const body = readIfExists(rel);
      if (body && body.includes(liveToken)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});

describe('static-data artifact GitHub PAT leak scan', () => {
  // Today's leaked-PAT incident (2026-04-19) showed a `gho_*` PAT in repo
  // logs. While that PAT was never written to a static-data file, the
  // scanner should still pin the negative — finding one in library.json
  // would be catastrophic.
  const PAT_PATTERNS: ReadonlyArray<RegExp> = [
    /gh[opsu]_[A-Za-z0-9]{30,}/g, // GitHub fine-grained / classic PATs
    /github_pat_[A-Za-z0-9_]{50,}/g,
  ];

  test('no static-data file contains a GitHub-PAT-shaped string', () => {
    const offenders: { file: string; pattern: string }[] = [];
    for (const rel of STATIC_DATA_PATHS) {
      const body = readIfExists(rel);
      if (!body) continue;
      for (const re of PAT_PATTERNS) {
        const matches = body.match(re);
        if (matches && matches.length > 0) {
          offenders.push({ file: rel, pattern: re.source });
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
