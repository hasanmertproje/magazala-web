import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots = ['apps/web', 'packages/core'];
const allowedExtensions = new Set(['.ts','.tsx','.js','.mjs','.json','.md']);
const forbidden = [
  { label: 'personalized production copy', pattern: /umut\s+abi/iu },
  { label: 'placeholder lorem ipsum', pattern: /lorem\s+ipsum/iu },
  { label: 'unfinished TODO marker', pattern: /\bTODO\b/u },
  { label: 'unfinished FIXME marker', pattern: /\bFIXME\b/u },
];

const failures = [];

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules','.next','dist'].includes(entry.name)) continue;
    const full = join(path, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (allowedExtensions.has(extname(entry.name))) {
      const content = await readFile(full, 'utf8');
      for (const rule of forbidden) if (rule.pattern.test(content)) failures.push(`${full}: ${rule.label}`);
    }
  }
}

for (const root of roots) await walk(root);
if (failures.length) {
  console.error('Production text policy failed:\n' + failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}
console.log('Production text policy passed.');
