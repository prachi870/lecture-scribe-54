import { promises as fs } from 'node:fs';
const content = await fs.readFile('./.env', 'utf8');
for (const line of content.split(/\r?\n/)) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  const [key, ...rest] = line.split('=');
  const value = rest.join('=');
  const raw = value;
  const trimmed = value.trim();
  console.log(`${key}|${raw.length}|${JSON.stringify(raw)}|${trimmed.length}|${JSON.stringify(trimmed)}`);
}
