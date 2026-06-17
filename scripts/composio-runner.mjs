import {Composio} from '@composio/core';

const TOOLKIT_VERSIONS = {
  stripe: '20260430_00',
  resend: '20260429_00',
  vercel: '20260429_00',
  github: '20260501_01',
  discord: '20260429_00',
  discordbot: '20260429_01',
  gmail: '20260515_00',
  lemon_squeezy: '20260506_00',
};

export function makeClient() {
  return new Composio({
    apiKey: process.env.COMPOSIO_API_KEY,
    toolkitVersions: TOOLKIT_VERSIONS,
  });
}

export const USER_ID = process.env.COMPOSIO_USER_ID || 'pg-test-7069c044-cd57-488b-9ce3-8cc8f504d3c6';

export async function call(slug, args = {}, userId = USER_ID) {
  const c = makeClient();
  const r = await c.tools.execute(slug, { userId, arguments: args });
  if (!r.successful) {
    throw new Error(`${slug} failed: ${r.error || JSON.stringify(r.data)}`);
  }
  return r.data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [slug, ...rest] = process.argv.slice(2);
  const args = rest.length ? JSON.parse(rest.join(' ')) : {};
  const data = await call(slug, args);
  console.log(JSON.stringify(data, null, 2));
}
