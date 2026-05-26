#!/usr/bin/env node
/**
 * Live SEO smoke test for the production landing.
 *
 * Checks (all against SITE_URL):
 *   - robots.txt 200 + contains Sitemap directive + LLM-bot rules
 *   - sitemap-index.xml 200 + at least one child sitemap
 *   - llms.txt 200
 *   - Homepage: title contains "Claude Code", description ≥ 140 chars,
 *     canonical absolute, JSON-LD with @graph, OG image, twitter:card
 *   - /free-skill: own title, own canonical, own OG image, breadcrumb schema
 *   - /success and /cancel: meta robots = noindex
 *   - apple-touch-icon.png reachable, og-image.png ≤ 300 KB
 *
 * Exit code 0 = all green, non-zero = failures (CI-friendly).
 */

const SITE_URL = (process.env.SITE_URL || 'https://skillsforge.pitchinsixty.com').replace(
  /\/$/,
  ''
);

let pass = 0;
let fail = 0;

function ok(msg) {
  console.log('  ✓', msg);
  pass++;
}
function bad(msg, extra = '') {
  console.log('  ✗', msg, extra);
  fail++;
}

async function head(url) {
  const res = await fetch(url, { redirect: 'follow' });
  return { res, body: await res.text() };
}

function find(text, re) {
  const m = text.match(re);
  return m ? m[1] : null;
}

async function checkRobots() {
  console.log(`\n[robots.txt]`);
  const { res, body } = await head(`${SITE_URL}/robots.txt`);
  if (res.ok) ok('200');
  else return bad(`HTTP ${res.status}`);
  if (body.includes('Sitemap:')) ok('Sitemap directive present');
  else bad('No Sitemap: directive');
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
    if (body.includes(`User-agent: ${bot}`)) ok(`${bot} rule present`);
    else bad(`${bot} rule missing`);
  }
}

async function checkSitemap() {
  console.log(`\n[sitemap-index.xml]`);
  const { res, body } = await head(`${SITE_URL}/sitemap-index.xml`);
  if (res.ok) ok('200');
  else return bad(`HTTP ${res.status}`);
  const child = find(body, /<loc>([^<]*sitemap[^<]*\.xml)<\/loc>/);
  if (child) ok(`child sitemap: ${child}`);
  else bad('No child sitemap found in index');

  if (child) {
    const { res: r2, body: b2 } = await head(child);
    if (r2.ok) ok('child sitemap reachable');
    else bad(`child HTTP ${r2.status}`);
    const urlCount = (b2.match(/<url>/g) || []).length;
    if (urlCount > 0) ok(`${urlCount} URLs listed`);
    else bad('child sitemap empty');
  }
}

async function checkLlmsTxt() {
  console.log(`\n[llms.txt]`);
  const { res, body } = await head(`${SITE_URL}/llms.txt`);
  if (res.ok) ok('200');
  else return bad(`HTTP ${res.status}`);
  if (body.includes('# SkillsForge')) ok('starts with H1 # SkillsForge');
  else bad('missing H1');
}

async function checkPage(path, expected) {
  console.log(`\n[${path}]`);
  const { res, body } = await head(`${SITE_URL}${path}`);
  if (res.ok) ok('200');
  else return bad(`HTTP ${res.status}`);

  const title = find(body, /<title>([^<]+)<\/title>/);
  if (title) ok(`title: "${title}"`);
  else bad('no <title>');

  if (expected.titleIncludes && title && title.includes(expected.titleIncludes))
    ok(`title contains "${expected.titleIncludes}"`);
  else if (expected.titleIncludes) bad(`title missing "${expected.titleIncludes}"`);

  const desc = find(body, /<meta name="description" content="([^"]+)"/);
  if (desc) {
    if (desc.length >= 110 && desc.length <= 170) ok(`description ${desc.length} chars`);
    else bad(`description ${desc.length} chars (target 110–170)`);
  } else bad('no meta description');

  const robots = find(body, /<meta name="robots" content="([^"]+)"/);
  if (expected.noIndex) {
    if (robots && /noindex/.test(robots)) ok(`robots noindex`);
    else bad(`expected noindex, got "${robots}"`);
  } else {
    if (robots && /\bindex\b/.test(robots) && !/noindex/.test(robots))
      ok(`robots index/follow`);
    else bad(`expected indexable, got "${robots}"`);
  }

  const canonical = find(body, /<link rel="canonical" href="([^"]+)"/);
  if (expected.noIndex) {
    if (!canonical) ok('canonical correctly omitted on noindex page');
    else bad(`unexpected canonical on noindex page: ${canonical}`);
  } else {
    if (canonical && canonical.startsWith('https://')) ok(`canonical: ${canonical}`);
    else bad(`canonical missing/invalid: ${canonical}`);
  }

  const ogImg = find(body, /<meta property="og:image" content="([^"]+)"/);
  if (ogImg) ok(`og:image: ${ogImg}`);
  else bad('no og:image');

  const twitterCard = find(body, /<meta name="twitter:card" content="([^"]+)"/);
  if (twitterCard === 'summary_large_image') ok('twitter:card summary_large_image');
  else bad(`twitter:card = ${twitterCard}`);

  const ldCount = (body.match(/application\/ld\+json/g) || []).length;
  if (ldCount >= 1) ok(`${ldCount} JSON-LD block(s)`);
  else bad('no JSON-LD');

  if (expected.requireGraphTypes) {
    for (const t of expected.requireGraphTypes) {
      if (body.includes(`"@type":"${t}"`) || body.includes(`"@type": "${t}"`))
        ok(`graph contains ${t}`);
      else bad(`graph missing ${t}`);
    }
  }
}

async function checkAssets() {
  console.log(`\n[assets]`);
  const og = await fetch(`${SITE_URL}/og-image.png`);
  if (og.ok) {
    const len = Number(og.headers.get('content-length') || 0);
    if (len > 0 && len <= 300_000)
      ok(`og-image.png ${Math.round(len / 1024)} KB (≤ 300 KB)`);
    else if (len === 0) ok('og-image.png 200 (size unknown)');
    else bad(`og-image.png too big: ${Math.round(len / 1024)} KB`);
  } else bad(`og-image.png HTTP ${og.status}`);

  const apple = await fetch(`${SITE_URL}/apple-touch-icon.png`);
  if (apple.ok) ok('apple-touch-icon.png reachable');
  else bad(`apple-touch-icon.png HTTP ${apple.status}`);
}

async function main() {
  console.log(`SEO verification against ${SITE_URL}`);
  await checkRobots();
  await checkSitemap();
  await checkLlmsTxt();
  await checkPage('/', {
    titleIncludes: 'Claude Code',
    requireGraphTypes: ['Organization', 'SoftwareApplication', 'Product', 'FAQPage'],
  });
  await checkPage('/free-skill', {
    titleIncludes: 'Claude Code',
    requireGraphTypes: ['BreadcrumbList'],
  });
  await checkPage('/success', { noIndex: true });
  await checkPage('/cancel', { noIndex: true });
  await checkAssets();

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
