/**
 * validatePrivacy.scope.test.ts
 * --------------------------------------------------------------------------
 * KAN-132: pin the FILES_TO_CHECK contract for scripts/validate-privacy.ts.
 *
 * Background:
 *   - public/data/library.json is the served static asset.
 *   - data/library.json is synthesized by scripts/sync-data-dir.cjs during
 *     prebuild and read at runtime by generateStaticParams +
 *     getRepoDetail's local-fallback path.
 *   - Today the sync step runs AFTER validate-privacy in `npm run prebuild`,
 *     so both files are identical at validation time. But a future
 *     re-ordering of build steps would silently bypass the gate.
 *
 * This test simply verifies the validator's source declares BOTH paths.
 * It is intentionally a string-level assertion against the script source —
 * the validator is a CLI runner that calls process.exit(), which is awkward
 * to invoke from jest without spawning a child process. Pinning the source
 * contract is sufficient and fast.
 */

import * as fs from 'fs';
import * as path from 'path';

const VALIDATOR_PATH = path.join(
  process.cwd(),
  'scripts',
  'validate-privacy.ts',
);

describe('scripts/validate-privacy.ts FILES_TO_CHECK scope — KAN-132', () => {
  const source = fs.readFileSync(VALIDATOR_PATH, 'utf-8');

  test('covers public/data/library.json (the served static asset)', () => {
    expect(source).toMatch(/path\.join\(process\.cwd\(\),\s*['"]public['"],\s*['"]data['"],\s*['"]library\.json['"]\)/);
  });

  test('covers public/data/owned.json (the owned-repos sidecar)', () => {
    expect(source).toMatch(/path\.join\(process\.cwd\(\),\s*['"]public['"],\s*['"]data['"],\s*['"]owned\.json['"]\)/);
  });

  test('covers data/library.json (the prebuild-synced runtime copy)', () => {
    // This is the KAN-132 addition. The path SHOULD be present.
    expect(source).toMatch(/path\.join\(process\.cwd\(\),\s*['"]data['"],\s*['"]library\.json['"]\)/);
  });

  test('FILES_TO_CHECK array contains exactly the three known paths', () => {
    // Defensive: if someone adds another artifact, this test will flag it
    // and force the contract owner to update the regression set.
    const arrayMatch = source.match(/const FILES_TO_CHECK = \[([\s\S]*?)\];/);
    expect(arrayMatch).not.toBeNull();
    const body = arrayMatch![1];
    const pathLines = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('path.join'));
    expect(pathLines.length).toBe(3);
  });
});
