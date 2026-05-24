/**
 * GET /api/download/[token]
 *
 * Validates the signed token from the welcome email, then streams the ZIP
 * from a private GitHub Release using a server-side PAT. No state stored
 * on our side — the token carries its own claims + expiry.
 *
 * On any validation failure: 404 to avoid leaking which step failed.
 * On GitHub fetch failure: 502 with a generic message.
 */

import type { APIRoute } from 'astro';
import { verifyDownloadToken } from '../../../lib/download-token';
import { clientKey, gcRateLimit, rateLimit } from '../../../lib/ratelimit';

const REPO_OWNER = 'kwouz';
const REPO_NAME = 'skillsforge-pack';

export const GET: APIRoute = async ({ params, request }) => {
  // Rate limit per IP — prevent token brute-force / abuse
  gcRateLimit();
  const rl = rateLimit('download', clientKey(request), 10, 60_000);
  if (!rl.ok) {
    return new Response('Too many requests', { status: 429 });
  }

  const token = params.token;
  if (typeof token !== 'string' || token.length < 16) {
    return new Response('Not found', { status: 404 });
  }

  const secret = import.meta.env.DOWNLOAD_SECRET;
  const githubPat = import.meta.env.GITHUB_PAT;

  if (!secret || !githubPat) {
    console.error('[download] Missing DOWNLOAD_SECRET or GITHUB_PAT env');
    return new Response('Service unavailable', { status: 503 });
  }

  const claims = verifyDownloadToken({ secret, token });
  if (!claims) {
    return new Response('Not found', { status: 404 });
  }

  console.log(`[download] valid token for sha256:${claims.e} tier=${claims.t} v=${claims.v}`);

  // Look up the asset id for this release version
  const releaseRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/v${claims.v}`,
    {
      headers: {
        Authorization: `Bearer ${githubPat}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!releaseRes.ok) {
    console.error(`[download] GitHub release lookup failed: ${releaseRes.status}`);
    return new Response('Release not found', { status: 502 });
  }

  const release = (await releaseRes.json()) as {
    assets: Array<{ id: number; name: string; size: number }>;
  };

  const zipAsset = release.assets.find((a) => a.name.endsWith('.zip'));
  if (!zipAsset) {
    console.error('[download] No ZIP asset in release');
    return new Response('Asset missing', { status: 502 });
  }

  // Stream the binary asset back — must request octet-stream to bypass html redirect
  const assetRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${zipAsset.id}`,
    {
      headers: {
        Authorization: `Bearer ${githubPat}`,
        Accept: 'application/octet-stream',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'follow',
    }
  );

  if (!assetRes.ok || !assetRes.body) {
    console.error(`[download] Asset fetch failed: ${assetRes.status}`);
    return new Response('Download failed', { status: 502 });
  }

  return new Response(assetRes.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="skillsforge-seo-pack-v${claims.v}.zip"`,
      'Content-Length': String(zipAsset.size),
      'Cache-Control': 'private, no-store',
    },
  });
};
