/**
 * Canonical tier definitions for SkillsForge.
 *
 * All code paths (checkout, webhook, email) must reference these constants
 * instead of duplicating the literal set. Unknown tiers in webhook payloads
 * must be rejected, not silently downgraded.
 */

export type Tier = 'starter' | 'pro' | 'team';

export const ALLOWED_TIERS: ReadonlySet<Tier> = new Set<Tier>([
  'starter',
  'pro',
  'team',
]);

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && ALLOWED_TIERS.has(value as Tier);
}
