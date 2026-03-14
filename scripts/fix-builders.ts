#!/usr/bin/env npx tsx
/**
 * fix-builders.ts
 *
 * One-shot fix for the builders field in public/data/library.json.
 * No API calls — uses only data already in the file.
 *
 * For forked repos: extracts upstream owner from forkedFrom (e.g. 'microsoft/semantic-kernel' → 'microsoft').
 * For built repos:  keeps the owner from fullName (e.g. 'perditioinc/my-repo' → 'perditioinc').
 *
 * Run: npm run fix-builders
 */

import * as fs from 'fs';
import * as path from 'path';
import { KNOWN_ORGS } from '../src/lib/buildTaxonomy';
import { LibraryData, Builder } from '../src/types/repo';

const libraryPath = path.join(process.cwd(), 'public', 'data', 'library.json');

if (!fs.existsSync(libraryPath)) {
  console.error('❌ public/data/library.json not found — run npm run generate first');
  process.exit(1);
}

const data: LibraryData = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));

let fixed = 0;

data.repos = data.repos.map((repo) => {
  const login = repo.isFork && repo.forkedFrom
    ? repo.forkedFrom.split('/')[0]
    : repo.fullName.split('/')[0];

  const key = login.toLowerCase();
  const knownOrg = KNOWN_ORGS[key];

  const builder: Builder = {
    login,
    name: knownOrg?.displayName ?? login,
    type: knownOrg ? 'organization' : 'user',
    avatarUrl: `https://avatars.githubusercontent.com/${login}`,
    isKnownOrg: !!knownOrg,
    orgCategory: knownOrg?.category ?? 'individual',
  };

  const current = repo.builders?.[0];
  if (current?.login !== login) {
    fixed++;
  }

  return { ...repo, builders: [builder] };
});

fs.writeFileSync(libraryPath, JSON.stringify(data, null, 2));

console.log(`✅ fix-builders complete — ${fixed} repos corrected, ${data.repos.length - fixed} already correct`);
