/** Simple in-memory rate limit tracker for API routes */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Check if a key (e.g., IP address) is within the allowed rate limit.
 * @param key - Identifier for the requester
 * @param maxRequests - Maximum requests allowed per window
 * @param windowMs - Time window in milliseconds
 * @returns true if the request is allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Get remaining requests for a key.
 * @param key - Identifier for the requester
 * @param maxRequests - Maximum requests allowed per window
 */
export function getRemainingRequests(key: string, maxRequests: number = 10): number {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.resetAt) return maxRequests;
  return Math.max(0, maxRequests - entry.count);
}

/**
 * Processes items in concurrent batches to avoid overwhelming external APIs.
 * Waits between batches to respect rate limits.
 * @param items - Array of items to process
 * @param fetchFn - Async function called for each item
 * @param maxConcurrent - Max parallel requests per batch (default 8)
 * @param delayBetweenBatches - Milliseconds to wait between batches (default 500)
 * @returns Results in the same order as items
 */
export async function batchFetch<T, R>(
  items: T[],
  fetchFn: (item: T) => Promise<R>,
  maxConcurrent = 8,
  delayBetweenBatches = 500
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += maxConcurrent) {
    const batch = items.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(batch.map(fetchFn));
    results.push(...batchResults);
    if (i + maxConcurrent < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }
  return results;
}
