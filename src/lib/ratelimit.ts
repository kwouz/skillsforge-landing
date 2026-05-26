/**
 * Lightweight in-memory rate limiter for public API endpoints.
 *
 * Limitations:
 * - Per-instance: each Vercel serverless cold-start resets the map. Good enough
 *   for slowing organic abuse; NOT a substitute for a real distributed limiter.
 * - For production, layer this with a Vercel Firewall rule on `/api/*`
 *   (5 req/IP/min) AND switch to `@upstash/ratelimit` + Upstash Redis once
 *   traffic justifies the dependency.
 *
 * Returns `null` if the request is within budget, otherwise an `error` payload
 * caller can return directly with status 429.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Best-effort client identification.
 *
 * Vercel's edge proxy appends the real client IP as the LAST entry in
 * `x-forwarded-for` and exposes it directly in `x-real-ip`. Trusting the
 * first hop is a spoofing vector — a request can ship `X-Forwarded-For:
 * 1.1.1.1, …` and bypass per-IP limits. We prefer `x-real-ip`, then fall
 * back to the rightmost (untrusted) hop in XFF.
 */
export function clientKey(request: Request): string {
  const real = request.headers.get('x-real-ip');
  if (real?.trim()) return real.trim();
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const hops = fwd.split(',').map((h) => h.trim()).filter(Boolean);
    const lastHop = hops[hops.length - 1];
    if (lastHop) return lastHop;
  }
  return 'anonymous';
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * @param key — Logical bucket name (e.g. `'checkout'`) — different endpoints get different budgets.
 * @param ident — Client identifier (typically `clientKey(request)`).
 * @param limit — Max requests in the window.
 * @param windowMs — Window length in milliseconds.
 */
export function rateLimit(
  key: string,
  ident: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const bucketKey = `${key}::${ident}`;
  const now = Date.now();
  const entry = buckets.get(bucketKey);

  if (!entry || entry.resetAt < now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true };
}

/**
 * Best-effort cleanup so the in-memory map does not grow unbounded on a long-lived instance.
 * Called from API routes opportunistically.
 */
export function gcRateLimit(): void {
  if (buckets.size < 1024) return;
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
}
