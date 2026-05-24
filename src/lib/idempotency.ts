/**
 * In-memory idempotency cache for Stripe webhook events.
 *
 * Stripe guarantees at-least-once delivery; the same `event.id` may arrive
 * multiple times. Without idempotency, a single purchase can fan out into
 * 2-5 duplicate emails.
 *
 * Limitations:
 * - Per-instance: a cold start loses state. In practice Stripe retries within
 *   minutes-to-hours, and the same Vercel instance often handles the retry —
 *   but this is best-effort, NOT a guarantee.
 *
 * Production migration: persist `event.id` to Supabase/KV/Redis with a 7-day TTL.
 */

const PROCESSED_EVENTS = new Map<string, number>(); // event.id -> expiresAt
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_ENTRIES = 5_000;

/**
 * Returns true if this is the first time we see this event.id (process it).
 * Returns false if it was already processed (skip — return 200 to Stripe).
 */
export function markEventProcessed(eventId: string): boolean {
  const now = Date.now();

  // Opportunistic GC: drop expired entries when map grows large
  if (PROCESSED_EVENTS.size > MAX_ENTRIES) {
    for (const [id, expiresAt] of PROCESSED_EVENTS) {
      if (expiresAt < now) PROCESSED_EVENTS.delete(id);
      if (PROCESSED_EVENTS.size <= MAX_ENTRIES / 2) break;
    }
  }

  const existing = PROCESSED_EVENTS.get(eventId);
  if (existing && existing > now) {
    return false; // already processed
  }
  PROCESSED_EVENTS.set(eventId, now + TTL_MS);
  return true;
}
