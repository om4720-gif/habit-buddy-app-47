// Best-effort rate limiting (sliding window) kept in memory by each server instance.
// It stops bursts and runaway scripts. It is not a hard global quota: a separate server
// instance has its own counters.

const buckets = new Map<string, { times: number[]; windowMs: number }>();
let calls = 0;

function sweep(now: number) {
  for (const [key, b] of buckets) {
    const newest = b.times[b.times.length - 1] ?? 0;
    if (now - newest > b.windowMs) buckets.delete(key);
  }
}

/** Counts a hit and says whether it is within `limit` per `windowMs`. */
export function checkLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  if (++calls % 500 === 0) sweep(now);
  const b = buckets.get(key) ?? { times: [], windowMs };
  b.windowMs = windowMs;
  b.times = b.times.filter((t) => now - t < windowMs);
  if (b.times.length >= limit) {
    buckets.set(key, b);
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((windowMs - (now - b.times[0]!)) / 1000)),
    };
  }
  b.times.push(now);
  buckets.set(key, b);
  return { ok: true, retryAfter: 0 };
}

/** How many hits are currently inside the window (without adding one). */
export function countHits(key: string, windowMs: number): number {
  const now = Date.now();
  return (buckets.get(key)?.times ?? []).filter((t) => now - t < windowMs).length;
}

export type Rule = { limit: number; windowMs: number; label: string };

/** Throws a friendly error if the user is over any rule; otherwise counts the request against all of them. */
export function limitUser(userId: string, bucket: string, rules: Rule[]) {
  for (const r of rules) {
    if (countHits(`${bucket}:${userId}:${r.windowMs}`, r.windowMs) >= r.limit) {
      const wait = r.windowMs >= 3_600_000 ? "tomorrow" : "in a minute";
      throw new Error(
        `You've reached the ${r.label} limit for this feature. Please try again ${wait}.`,
      );
    }
  }
  for (const r of rules) checkLimit(`${bucket}:${userId}:${r.windowMs}`, r.limit, r.windowMs);
}

export function clientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export const MINUTE = 60_000;
export const DAY = 86_400_000;
