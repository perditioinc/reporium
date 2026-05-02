/** @jest-environment node */

// Smoke: no private repository data leaks into the public static bundle.
//
// CONTEXT
// 2026-04-27 P0 incident — the live `library.json` contained
// `perditioinc/hippo-harvest-assignment` (private) because the build
// pipeline had no field-driven privacy filter. The fix is being shipped
// in the static-artifact privacy hotfix:
//
//   PR #278 — fix(privacy): P0 — static artifact privacy guard (fail-closed)
//   Branch: claude/hotfix/static-private-artifact-2026-04-28
//
// The hotfix accepts ANY of three privacy fields per repo
// (`isPrivate` / `private` / `visibility`) and FAILS CLOSED if the field
// is missing, plus a static blocklist that pins the hippo regression.
//
// SMOKE SHAPE
// This file is split into two halves:
//
//   1. BASELINE (green today) — schema hygiene that should always hold:
//      no `private:true`, no non-public `visibility`, all URLs https,
//      no PAT pattern in `fullName`, sitemap.xml does not list hippo.
//
//   2. PENDING — PR #278 contract (currently RED) — every repo declares a
//      privacy indicator AND `library.json` does not contain hippo. These
//      tests use `test.failing`: each turns the suite red when (and only
//      when) the contract lands, prompting the maintainer to remove the
//      `.failing` annotation.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface MaybePrivate {
  private?: unknown;
  isPrivate?: unknown;
  visibility?: unknown;
  url?: unknown;
  fullName?: unknown;
  name?: unknown;
}

const HIPPO_FULL_NAME = 'perditioinc/hippo-harvest-assignment';
const HIPPO_REPO_NAME = 'hippo-harvest-assignment';

const PUBLIC_DATA_DIR = join(process.cwd(), 'public', 'data');
const SITEMAP_PATH = join(process.cwd(), 'public', 'sitemap.xml');

function readJson<T = unknown>(absPath: string): T {
  return JSON.parse(readFileSync(absPath, 'utf-8')) as T;
}

function hasPrivacyIndicator(repo: MaybePrivate): boolean {
  // The privacy filter in PR #278 accepts ANY of these three fields. A repo
  // with NONE of them is "unknown verdict" and will be excluded by the
  // fail-closed gate.
  const has = (key: keyof MaybePrivate) =>
    Object.prototype.hasOwnProperty.call(repo, key) && repo[key] != null;
  return has('isPrivate') || has('private') || has('visibility');
}

function expectPublicShape(repo: MaybePrivate, where: string): void {
  if (Object.prototype.hasOwnProperty.call(repo, 'private')) {
    expect(repo.private).not.toBe(true);
  }
  if (typeof repo.visibility === 'string') {
    expect(repo.visibility).toBe('public');
  }
  if (typeof repo.url === 'string') {
    expect(repo.url).toMatch(/^https:\/\/github\.com\//);
    expect(repo.url).not.toContain('@');
    expect(repo.url).not.toContain('ssh://');
  }
  if (typeof repo.fullName === 'string') {
    expect(repo.fullName).toMatch(/^[^/\s]+\/[^/\s]+$/);
    expect(repo.fullName).not.toMatch(/(ghp_|github_pat_|gho_|ghs_)/);
  }
  expect(typeof repo.name).toBe('string');
  expect((repo.name as string).length).toBeGreaterThan(0);
  void where;
}

describe('smoke: no private repos in public static data — BASELINE', () => {
  test('public/data/library.json has no explicit private:true / non-public visibility', () => {
    const path = join(PUBLIC_DATA_DIR, 'library.json');
    expect(existsSync(path)).toBe(true);
    const lib = readJson<{ repos: MaybePrivate[] }>(path);
    expect(Array.isArray(lib.repos)).toBe(true);
    expect(lib.repos.length).toBeGreaterThan(0);
    for (const repo of lib.repos) {
      expectPublicShape(repo, `library.json:${repo.name}`);
    }
  });

  test('public/data/owned.json (when present) has no explicit private:true', () => {
    const path = join(PUBLIC_DATA_DIR, 'owned.json');
    if (!existsSync(path)) return;
    const owned = readJson<{ repos?: MaybePrivate[] }>(path);
    if (!Array.isArray(owned.repos)) return;
    for (const repo of owned.repos) {
      expectPublicShape(repo, `owned.json:${repo.name}`);
    }
  });

  test('public/sitemap.xml does not list hippo-harvest-assignment', () => {
    // Sitemap is the agent-facing surface; even before library.json is
    // regenerated, the sitemap edge MUST stay clean. PR #278 re-runs the
    // privacy filter at the sitemap edge so the fail-closed shape can't be
    // bypassed by a stale library.json.
    if (!existsSync(SITEMAP_PATH)) return;
    const xml = readFileSync(SITEMAP_PATH, 'utf-8');
    expect(xml).not.toContain(HIPPO_REPO_NAME);
    expect(xml).not.toContain(HIPPO_FULL_NAME);
  });

  test('public/data/owned.json does not list hippo-harvest-assignment', () => {
    // owned.json is the perditioinc-owned-repos slice. It is already
    // clean on origin/main today (the leak vector ran through library.json
    // only) — this test PINS that state so a future regression can't
    // re-introduce the repo via the owned-repos path.
    const path = join(PUBLIC_DATA_DIR, 'owned.json');
    if (!existsSync(path)) return;
    const raw = readFileSync(path, 'utf-8');
    expect(raw).not.toContain(HIPPO_FULL_NAME);
    expect(raw).not.toContain(HIPPO_REPO_NAME);
  });
});

// ---------------------------------------------------------------------------
// PROMOTED — PR #278 (claude/hotfix/static-private-artifact-2026-04-28) has
// landed; the privacy-filter contract is live. The two assertions below were
// originally `test.failing` markers tied to that PR. With #278 + the
// privacy-aware reporium-api change in main, they now pass on origin/main and
// have been moved into the BASELINE describe block. Keep them there: any
// future regression that drops the privacy field or re-introduces hippo will
// flip these red.
// ---------------------------------------------------------------------------
describe('smoke: no private repos in public static data — PROMOTED (PR #278)', () => {
  test('every repo in public/data/library.json declares a privacy indicator (isPrivate | private | visibility)', () => {
    const path = join(PUBLIC_DATA_DIR, 'library.json');
    const lib = readJson<{ repos: MaybePrivate[] }>(path);
    const missing: string[] = [];
    for (const repo of lib.repos) {
      if (!hasPrivacyIndicator(repo)) {
        missing.push((repo.name as string) ?? '<unnamed>');
      }
    }
    expect(missing).toEqual([]);
  });

  test('public/data/library.json does not contain perditioinc/hippo-harvest-assignment', () => {
    // Pinned regression check — this repo MUST never appear in the public
    // artifact again (privacy-filter.ts static blocklist mirrors this).
    const path = join(PUBLIC_DATA_DIR, 'library.json');
    const raw = readFileSync(path, 'utf-8');
    expect(raw).not.toContain(HIPPO_FULL_NAME);
    expect(raw).not.toContain(HIPPO_REPO_NAME);
  });
});
