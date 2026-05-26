/**
 * Canonical tier definitions for SkillsForge.
 *
 * /api/checkout uses `isTier` to validate user-supplied tier strings
 * before mapping them to a Gumroad URL. Treat any value outside this
 * set as a 400, never as a default.
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
