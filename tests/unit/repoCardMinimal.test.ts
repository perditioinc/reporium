/**
 * repoCardMinimal.test.ts
 * Regression tests for RepoCardMinimal:
 * - CSS border properties must not mix shorthand (border) and non-shorthand (borderTop)
 *   to avoid framer-motion rerender warnings
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// We can't easily render motion.div in server-side tests, so we validate the
// style logic directly by reading the component source for the CSS conflict pattern.
import fs from 'fs';
import path from 'path';

const COMPONENT_PATH = path.resolve(__dirname, '../../src/components/RepoCardMinimal.tsx');

describe('RepoCardMinimal — CSS shorthand conflict regression', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(COMPONENT_PATH, 'utf-8');
  });

  test('does not mix border shorthand with borderTop/borderRight/borderBottom/borderLeft in same style object', () => {
    // Extract all style={{ ... }} blocks
    // Split on style={{ and collect blocks manually to avoid 's' regex flag (ES2018+)
    const styleBlocks: string[] = [];
    const parts = source.split('style={{');
    for (let i = 1; i < parts.length; i++) {
      const end = parts[i].indexOf('}}');
      if (end !== -1) styleBlocks.push('style={{' + parts[i].substring(0, end + 2));
    }

    for (const block of styleBlocks) {
      const hasBorderShorthand = /\bborder\s*:/.test(block);
      const hasBorderTop = /\bborderTop\s*:/.test(block);
      const hasBorderRight = /\bborderRight\s*:/.test(block);
      const hasBorderBottom = /\bborderBottom\s*:/.test(block);
      const hasBorderLeft = /\bborderLeft\s*:/.test(block);

      const hasLonghand = hasBorderTop || hasBorderRight || hasBorderBottom || hasBorderLeft;

      // If a style block has both shorthand `border:` and any longhand border property,
      // that's the exact pattern that causes framer-motion CSS warnings.
      if (hasBorderShorthand && hasLonghand) {
        fail(
          `Found mixed border shorthand and longhand in same style block. ` +
          `This causes framer-motion rerender warnings.\n` +
          `Block: ${block.slice(0, 200)}...`
        );
      }
    }
  });

  test('uses non-shorthand border properties for the main card container', () => {
    // The main motion.div should use borderTop, borderRight, borderBottom, borderLeft
    // instead of border + borderTop
    expect(source).toContain('borderTop:');
    expect(source).toContain('borderRight:');
    expect(source).toContain('borderBottom:');
    expect(source).toContain('borderLeft:');
  });
});
