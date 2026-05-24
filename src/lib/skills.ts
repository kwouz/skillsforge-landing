/**
 * Серверный парсер SKILL.md файлов из папки skills/
 * Читает frontmatter (name, description) из каждого скилла.
 * Путь к skills-директории передаётся через ENV переменную SKILLS_DIR
 * или берётся относительно проекта по умолчанию.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

export interface SkillMeta {
  slug: string;
  name: string;
  description: string;
  version: string;
  isFree: boolean;
}

/** Парсит YAML frontmatter из Markdown файла без внешних зависимостей */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: Record<string, string> = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && value) result[key] = value;
  }

  return result;
}

/** Загружает все скиллы из указанной директории */
export function loadSkills(skillsDir: string): SkillMeta[] {
  const resolvedDir = resolve(skillsDir);

  let entries: string[];
  try {
    entries = readdirSync(resolvedDir);
  } catch {
    console.warn(`[skills] Cannot read skills directory: ${resolvedDir}`);
    return getFallbackSkills();
  }

  const skills: SkillMeta[] = [];

  for (const entry of entries) {
    const entryPath = join(resolvedDir, entry);
    try {
      if (!statSync(entryPath).isDirectory()) continue;

      const skillPath = join(entryPath, 'SKILL.md');
      const content = readFileSync(skillPath, 'utf-8');
      const fm = parseFrontmatter(content);

      skills.push({
        slug: entry,
        name: fm.name ?? entry,
        description: fm.description ?? '',
        version: fm.version ?? '1.0.0',
        isFree: entry === 'free-teaser-seo-meta',
      });
    } catch {
      // Пропускаем директории без SKILL.md
    }
  }

  // Сортировка: сначала платные, в конце бесплатный
  return skills.sort((a, b) => {
    if (a.isFree && !b.isFree) return 1;
    if (!a.isFree && b.isFree) return -1;
    return a.slug.localeCompare(b.slug);
  });
}

/** Fallback данные, если skills директория недоступна (preview режим) */
function getFallbackSkills(): SkillMeta[] {
  return [
    { slug: 'seo-pseo-generator', name: 'seo-pseo-generator', description: 'Build programmatic SEO sites that actually rank — generate 1k-100k pages from a structured dataset.', version: '1.0.0', isFree: false },
    { slug: 'geo-aeo-optimizer', name: 'geo-aeo-optimizer', description: 'Make content visible inside ChatGPT, Claude, Perplexity, Gemini, and Google AI Overviews.', version: '1.0.0', isFree: false },
    { slug: 'schema-markup-engineer', name: 'schema-markup-engineer', description: 'Generate validated, type-correct JSON-LD schema markup for any page.', version: '1.0.0', isFree: false },
    { slug: 'content-brief-builder', name: 'content-brief-builder', description: 'Generate a production-grade SEO content brief in one pass.', version: '1.0.0', isFree: false },
    { slug: 'technical-seo-auditor', name: 'technical-seo-auditor', description: 'Run a full technical SEO audit on any site — crawl, render, index, Core Web Vitals.', version: '1.0.0', isFree: false },
    { slug: 'keyword-cluster-mapper', name: 'keyword-cluster-mapper', description: 'Turn a flat keyword list into ranked topical clusters with pillar+supporting hierarchy.', version: '1.0.0', isFree: false },
    { slug: 'internal-linking-architect', name: 'internal-linking-architect', description: 'Design and execute internal linking strategy — pillar/cluster hubs, anchor diversity.', version: '1.0.0', isFree: false },
    { slug: 'ai-mentions-monitor', name: 'ai-mentions-monitor', description: 'Track how often your brand appears in ChatGPT, Claude, Perplexity, Gemini daily dashboards.', version: '1.0.0', isFree: false },
    { slug: 'backlink-outreach-engine', name: 'backlink-outreach-engine', description: 'Run prospecting + personalized outreach + follow-up for white-hat link building at scale.', version: '1.0.0', isFree: false },
    { slug: 'gbp-local-seo', name: 'gbp-local-seo', description: 'Optimize Google Business Profile + local citations + review acquisition for local businesses.', version: '1.0.0', isFree: false },
    { slug: 'free-teaser-seo-meta', name: 'seo-meta-generator', description: 'FREE — Generate Google-perfect title tag and meta description for any URL or topic.', version: '1.0.0', isFree: true },
  ];
}
