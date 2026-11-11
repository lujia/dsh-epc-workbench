import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const srcDir = join(root, 'src', 'client');

const files = readdirSync(srcDir)
  .filter((f) => f.endsWith('.js'))
  .sort();

const parts = files.map((f) => readFileSync(join(srcDir, f), 'utf8').replace(/\s+$/, ''));
const epilogue = [
  '',
  '\t\t/* ============================ module ============================ */',
  "\t\treturn { inject: ['slots'], apply: apply };",
  '\t}',
  '});',
  '',
].join('\n');

const out = parts.join('\n\n') + '\n' + epilogue;
const target = join(root, 'client.js');
writeFileSync(target, out, 'utf8');
console.log('built ' + target + ' — ' + out.length + ' bytes from ' + files.length + ' fragments');
console.log('fragments: ' + files.join(', '));
