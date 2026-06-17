import { readFileSync, writeFileSync } from 'node:fs';

const ENV_PATH = '../.env.production.local';
const GUILD_ID = '1508096950417752184';
const API = 'https://discord.com/api/v10';

function loadToken() {
  const txt = readFileSync(ENV_PATH, 'utf8');
  const m = txt.match(/^DISCORD_BOT_TOKEN=(.+)$/m);
  if (!m) throw new Error('DISCORD_BOT_TOKEN missing in .env.production.local');
  return m[1].trim();
}

const TOKEN = loadToken();

async function dc(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return await res.json();
}

// 1. Roles (created in reverse order so they appear top→bottom correctly)
const ROLES = [
  { name: 'Founder', color: 0xfacc15, hoist: true, mentionable: false }, // amber
  { name: 'Team',    color: 0xa78bfa, hoist: true, mentionable: true  }, // lilac
  { name: 'Pro',     color: 0x7c5cff, hoist: true, mentionable: true  }, // violet
  { name: 'Beta',    color: 0x3ddc97, hoist: true, mentionable: true  }, // mint
];

// 2. Channel structure
const CATEGORIES = [
  {
    name: 'WELCOME',
    channels: [
      { name: 'welcome',    type: 0, topic: 'Start here. Read the welcome message.' },
      { name: 'announcements', type: 0, topic: 'Pack updates, release notes, important news.' },
    ],
  },
  {
    name: 'SKILLS',
    channels: [
      { name: 'help',        type: 0, topic: 'Stuck? Ask here — answered within 24h. Slow mode 5s.', rate_limit_per_user: 5 },
      { name: 'show-and-tell', type: 0, topic: 'Share what you built. Drop screenshots, before/after.' },
      { name: 'requests',    type: 0, topic: 'Suggest new skills or features.' },
      { name: 'bugs',        type: 0, topic: 'Report issues with any skill. Include repro steps.' },
    ],
  },
  {
    name: 'PRO',
    channels: [
      { name: 'pro-only',    type: 0, topic: 'Pro tier only. Monthly drops, Q&A signups.', perms_pro: true },
      { name: 'monthly-drop', type: 0, topic: 'New skills released here for Pro members.', perms_pro: true },
    ],
  },
  {
    name: 'COMMUNITY',
    channels: [
      { name: 'introductions', type: 0, topic: 'New here? Say hello. What do you work on?' },
      { name: 'general',     type: 0, topic: 'Open chat. SEO, GEO, AEO, AI search.' },
      { name: 'off-topic',   type: 0, topic: 'Memes, side projects, coffee.' },
    ],
  },
];

console.log('→ creating roles');
const createdRoles = {};
for (const r of ROLES) {
  const role = await dc('POST', `/guilds/${GUILD_ID}/roles`, r);
  createdRoles[r.name] = role.id;
  console.log(`  ✓ ${r.name} id=${role.id}`);
}

console.log('\n→ creating categories + channels');
const createdChannels = {};
const PRO_ROLE = createdRoles['Pro'];
const TEAM_ROLE = createdRoles['Team'];

for (const cat of CATEGORIES) {
  const category = await dc('POST', `/guilds/${GUILD_ID}/channels`, {
    name: cat.name,
    type: 4, // GUILD_CATEGORY
  });
  console.log(`  ✓ category ${cat.name} id=${category.id}`);

  for (const ch of cat.channels) {
    const body = {
      name: ch.name,
      type: ch.type,
      parent_id: category.id,
      topic: ch.topic,
    };
    if (ch.rate_limit_per_user) body.rate_limit_per_user = ch.rate_limit_per_user;
    // Pro-only channels: deny @everyone read; allow Pro + Team + Founder
    if (ch.perms_pro) {
      body.permission_overwrites = [
        { id: GUILD_ID, type: 0, deny: '1024' }, // @everyone: deny VIEW_CHANNEL
        { id: PRO_ROLE, type: 0, allow: '1024' },
        { id: TEAM_ROLE, type: 0, allow: '1024' },
        { id: createdRoles['Founder'], type: 0, allow: '1024' },
      ];
    }
    const channel = await dc('POST', `/guilds/${GUILD_ID}/channels`, body);
    createdChannels[ch.name] = channel.id;
    console.log(`    ✓ #${ch.name} id=${channel.id}`);
  }
}

console.log('\n→ posting welcome message in #welcome');
const welcomeText = [
  '# Welcome to SkillsForge 🛠️',
  '',
  '**11 production-grade Claude Code skills for SEO/GEO specialists.**',
  '',
  '**Get oriented (2 min):**',
  '1. Drop your install path / pain point in <#' + createdChannels['introductions'] + '>',
  '2. Ask anything in <#' + createdChannels['help'] + '> — answered within 24h',
  '3. Share wins / before-after in <#' + createdChannels['show-and-tell'] + '>',
  '',
  '**Pro members:** <#' + createdChannels['pro-only'] + '> + <#' + createdChannels['monthly-drop'] + '>',
  '',
  '**House rules:**',
  '• No self-promo without value attached',
  '• Real questions get real answers — show your repo / output / error',
  '• If you ship something useful with a skill, tag it #builtwith',
  '',
  'Need direct support: support@pitchinsixty.com',
].join('\n');

await dc('POST', `/channels/${createdChannels.welcome}/messages`, { content: welcomeText });
console.log('  ✓ welcome message posted');

console.log('\n→ creating permanent invite');
const invite = await dc('POST', `/channels/${createdChannels.welcome}/invites`, {
  max_age: 0,        // never expires
  max_uses: 0,       // unlimited
  unique: false,
});
const inviteUrl = `https://discord.gg/${invite.code}`;
console.log(`  ✓ invite: ${inviteUrl}`);

const summary = {
  guild_id: GUILD_ID,
  guild_name: 'SkillsForge',
  invite_url: inviteUrl,
  invite_code: invite.code,
  roles: createdRoles,
  channels: createdChannels,
};

writeFileSync('./scripts/discord-setup.json', JSON.stringify(summary, null, 2));
console.log('\n✅ saved scripts/discord-setup.json');
console.log('Invite URL for Vercel ENV:', inviteUrl);
