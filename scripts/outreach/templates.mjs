// Outreach copy templates. Keep short, personalize via {{name}} / {{note}}.

export const TEMPLATES = {
  // ─── X / LinkedIn cold DM ───
  'cold-solo-1': {
    subject: '',
    body: `Hey {{name}} — saw your recent post on AI Overviews / GEO. {{note}}

Built SkillsForge: 11 production Claude Code skills for SEO/GEO pipelines (keyword cluster → brief → schema → audit). Cuts 4-8h/week of repetitive client work.

$49 lifetime starter. 30-day refund.

https://skillsforge.pitchinsixty.com

Worth a look?`,
  },

  'cold-agency-2': {
    subject: '',
    body: `Hi {{name}} — running an agency where AI Overviews tanked client traffic? {{note}}

SkillsForge gives your team 11 Claude Code skills with a shared pipeline. Standardize SEO/GEO audits across the team. $199/yr Team license (5 seats).

Demo: https://skillsforge.pitchinsixty.com

Open to a 15-min call this week?`,
  },

  'cold-inhouse-3': {
    subject: '',
    body: `Hi {{name}} — saw your work scaling SEO at {{company}}. {{note}}

Built a Claude Code pack that productionizes the SEO/GEO pipeline — 11 skills replacing scattered prompts and tools. Pro is $14/mo, includes monthly skill drops.

https://skillsforge.pitchinsixty.com

5-min ask: would you use this?`,
  },

  // ─── Email versions ───
  'warm-pitch': {
    subject: 'Built a thing — would love your eyes on it',
    body: `Hey {{name}},

{{note}}

Just shipped SkillsForge — 11 production Claude Code skills for SEO/GEO/AEO workflows. Each skill is a self-contained piece of the pipeline (cluster mapping, content brief, schema markup, technical audit, AI mentions monitor, etc).

The pitch: replace 3-5 paid tools + ad-hoc prompts with one structured pack. $49 lifetime starter (30-day refund).

Live: https://skillsforge.pitchinsixty.com

If it solves a real pain — would mean a lot if you tried it and sent 2 lines of feedback. No pressure.

— Ilya
`,
  },

  'welcome-launch': {
    subject: 'SkillsForge is live — 11 Claude Code skills for SEO/GEO',
    body: `Hi {{name}},

Shipped today: 11 production Claude Code skills covering the full SEO/GEO/AEO pipeline.

→ Keyword cluster → content brief → schema markup
→ Technical audit → internal linking → backlink outreach
→ AI Overviews monitor → GBP / local SEO

$49 lifetime Starter. $14/mo Pro (monthly drops + Discord). 30-day refund.

Live: https://skillsforge.pitchinsixty.com

Discord community: https://discord.gg/jevtge9Npk

— Ilya
`,
  },

  'aleyda-pitch': {
    subject: '',
    body: `Hi Aleyda — long-time reader of SEOFOMO.

Built SkillsForge: 11 production Claude Code skills covering the SEO→GEO pipeline (cluster mapping → content brief → schema → technical audit → AI mentions monitor → backlinks).

The thinking: GEO is fundamentally a pipeline problem, not a checklist. Each skill knows about the others. One prompt — "optimize this cluster for GEO" — runs the whole chain.

Prepared a "GEO Pipeline Benchmark Report" using the pack on 12 verticals — happy to send the PDF if interesting. Would love your take on the framing before public launch.

https://skillsforge.pitchinsixty.com

— Ilya`,
  },
};

export function render(template, vars = {}) {
  let body = TEMPLATES[template]?.body || '';
  let subject = TEMPLATES[template]?.subject || '';
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
    body = body.replace(re, v ?? '');
    subject = subject.replace(re, v ?? '');
  }
  // strip leftover handlebars (vars that weren't provided)
  body = body.replace(/{{[^}]+}}/g, '').replace(/\n{3,}/g, '\n\n');
  return { subject, body };
}
