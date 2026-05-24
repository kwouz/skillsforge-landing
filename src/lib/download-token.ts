/**
 * Signed download tokens for ZIP delivery.
 *
 * After a successful purchase the webhook mints a JWT-style token that
 * encodes (email hash, tier, version, expiry, nonce) and is signed with
 * DOWNLOAD_SECRET. The customer receives an URL like:
 *
 *   https://<site>/api/download/<token>
 *
 * The download endpoint validates the signature + expiry, then streams the
 * ZIP from the private GitHub Release using a server-side PAT.
 *
 * No state on our side. Tokens self-expire.
 */

import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

export interface DownloadClaims {
  /** SHA-256 prefix of the email (12 hex chars) — for log attribution */
  e: string;
  /** Tier: starter / pro / team */
  t: string;
  /** Release version, e.g. "1.0.0" */
  v: string;
  /** Expiry unix seconds */
  x: number;
  /** Random nonce, prevents URL replay */
  n: string;
}

const DEFAULT_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

function base64UrlEncode(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf-8');
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer {
  const pad = (4 - (str.length % 4)) % 4;
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad), 'base64');
}

function hmacSha256(secret: string, payload: string): string {
  return base64UrlEncode(createHmac('sha256', secret).update(payload).digest());
}

function emailHashShort(email: string): string {
  const h = createHmac('sha256', 'skillsforge-download-token').update(email.toLowerCase().trim()).digest('hex');
  return h.slice(0, 12);
}

/**
 * Mint a download token for a paying customer.
 * Returns null if DOWNLOAD_SECRET is missing/placeholder.
 */
export function mintDownloadToken(params: {
  secret: string;
  email: string;
  tier: string;
  version: string;
  ttlSec?: number;
}): string | null {
  if (!params.secret || params.secret.startsWith('placeholder')) return null;
  const claims: DownloadClaims = {
    e: emailHashShort(params.email),
    t: params.tier,
    v: params.version,
    x: Math.floor(Date.now() / 1000) + (params.ttlSec ?? DEFAULT_TTL_SEC),
    n: randomBytes(8).toString('hex'),
  };
  const payload = base64UrlEncode(JSON.stringify(claims));
  const sig = hmacSha256(params.secret, payload);
  return `${payload}.${sig}`;
}

/**
 * Validate a download token. Returns claims on success, null on failure.
 * Caller should treat null as 404 (don't leak whether signature or expiry failed).
 */
export function verifyDownloadToken(params: {
  secret: string;
  token: string;
}): DownloadClaims | null {
  if (!params.secret || params.secret.startsWith('placeholder')) return null;
  const parts = params.token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = hmacSha256(params.secret, payload);
  // Constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: DownloadClaims;
  try {
    claims = JSON.parse(base64UrlDecode(payload).toString('utf-8'));
  } catch {
    return null;
  }
  if (!claims.e || !claims.t || !claims.v || !claims.x || !claims.n) return null;
  if (claims.x < Math.floor(Date.now() / 1000)) return null;
  return claims;
}
