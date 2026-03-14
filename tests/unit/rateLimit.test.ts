import { checkRateLimit, getRemainingRequests, batchFetch } from '@/lib/rateLimit';

describe('checkRateLimit', () => {
  it('allows requests within the limit', () => {
    const key = `test-${Date.now()}`;
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
  });

  it('blocks requests exceeding the limit', () => {
    const key = `test-block-${Date.now()}`;
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    expect(checkRateLimit(key, 2, 60_000)).toBe(false);
  });

  it('tracks remaining requests', () => {
    const key = `test-remain-${Date.now()}`;
    expect(getRemainingRequests(key, 5)).toBe(5);
    checkRateLimit(key, 5, 60_000);
    expect(getRemainingRequests(key, 5)).toBe(4);
  });
});

describe('batchFetch', () => {
  it('processes all items and returns results in order', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await batchFetch(items, async (n) => n * 2, 3, 0);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('respects concurrency — processes in batches', async () => {
    const concurrentCounts: number[] = [];
    let current = 0;
    const items = Array.from({ length: 6 }, (_, i) => i);
    await batchFetch(
      items,
      async () => {
        current++;
        concurrentCounts.push(current);
        await new Promise((r) => setTimeout(r, 10));
        current--;
      },
      2,
      0
    );
    // Max concurrent should never exceed 2
    expect(Math.max(...concurrentCounts)).toBeLessThanOrEqual(2);
  });
});
