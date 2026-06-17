import { appendFileSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = resolve(__dirname, 'outreach-log.csv');
const HEADER = 'timestamp,channel,recipient,template,status,error\n';

if (!existsSync(LOG_FILE)) writeFileSync(LOG_FILE, HEADER);

function escape(v) {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
}

export function log({ channel, recipient, template = '', status, error = '' }) {
  const row = [new Date().toISOString(), channel, recipient, template, status, error]
    .map(escape)
    .join(',');
  appendFileSync(LOG_FILE, row + '\n');
}

export function alreadyContacted(channel, recipient) {
  if (!existsSync(LOG_FILE)) return false;
  const lines = readFileSync(LOG_FILE, 'utf8').split('\n');
  return lines.some(
    (l) => l.includes(`,${channel},${recipient},`) && l.includes(',sent,')
  );
}

export function countToday(channel) {
  if (!existsSync(LOG_FILE)) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const lines = readFileSync(LOG_FILE, 'utf8').split('\n');
  return lines.filter((l) => l.startsWith(today) && l.includes(`,${channel},`) && l.includes(',sent,')).length;
}
