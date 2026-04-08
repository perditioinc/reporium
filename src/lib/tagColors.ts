/**
 * Deterministic tag → color mapping.
 * Hashes the tag string to a hue; uses consistent saturation/lightness
 * so all tags look intentional and cohesive on dark backgrounds.
 *
 * Two tags with the same hue on the same card are avoided by the caller
 * using the `assignTagColors()` helper which offsets collisions.
 */

/** Simple 32-bit djb2 hash, returns a number 0–359 (hue) */
function hashToHue(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h % 360;
}

export interface TagColor {
  background: string;
  border: string;
  color: string;
  hue: number;
}

export function getTagColor(tag: string): TagColor {
  const hue = hashToHue(tag.toLowerCase().trim());
  return {
    background: `hsla(${hue}, 70%, 60%, 0.15)`,
    border:     `1px solid hsla(${hue}, 70%, 60%, 0.4)`,
    color:      `hsla(${hue}, 70%, 82%, 1)`,
    hue,
  };
}

/**
 * Assign colors to a list of tags, offsetting hues that would collide
 * (< 18° apart) so no two visible tags on the same card share a near-identical hue.
 */
export function assignTagColors(tags: string[]): Array<TagColor & { tag: string }> {
  const MIN_DIFF = 18;
  const result: Array<TagColor & { tag: string }> = [];
  const usedHues: number[] = [];

  for (const tag of tags) {
    let { hue } = getTagColor(tag);

    // Offset until clear of existing hues
    let attempts = 0;
    while (
      attempts < 20 &&
      usedHues.some((h) => Math.min(Math.abs(hue - h), 360 - Math.abs(hue - h)) < MIN_DIFF)
    ) {
      hue = (hue + MIN_DIFF) % 360;
      attempts++;
    }

    usedHues.push(hue);
    result.push({
      tag,
      background: `hsla(${hue}, 70%, 60%, 0.15)`,
      border:     `1px solid hsla(${hue}, 70%, 60%, 0.4)`,
      color:      `hsla(${hue}, 70%, 82%, 1)`,
      hue,
    });
  }

  return result;
}
