import { readFileSync } from 'node:fs';

// Tiny CSV parser. Handles quoted fields with embedded commas.
export function parseCsv(path) {
  const txt = readFileSync(path, 'utf8').trim();
  if (!txt) return [];
  const lines = txt.split(/\r?\n/);
  const header = splitLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = splitLine(line);
    return Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? '').trim()]));
  });
}

function splitLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}
