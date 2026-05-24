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
 * Cloudflare/Vercel forward original IP via `x-forwarded-for` (comma list — first hop wins).
 * Falls back to `x-real-ip`, then a generic bucket key.
 */
export function clientKey(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const ip = fwd.split(',')[0]?.trim();
    if (ip) return ip;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
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
