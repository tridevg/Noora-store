// Initial JS bundle gate (architecture.md section 9, plan task 6.2).
// Reads dist/index.html only; builds nothing. Sums gzip level 9 of every
// <script type="module" src> and <link rel="modulepreload" href> file.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const LIMIT = 150_000;
const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '..', 'dist');
const indexPath = join(distDir, 'index.html');

const html = readFileSync(indexPath, 'utf8');

const refs = new Set();
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1];
for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
  const isModuleScript = /^<script\b/i.test(tag) && attr(tag, 'type') === 'module';
  const isModulePreload = /^<link\b/i.test(tag) && attr(tag, 'rel') === 'modulepreload';
  const href = isModuleScript ? attr(tag, 'src') : isModulePreload ? attr(tag, 'href') : undefined;
  if (href) refs.add(href);
}

if (refs.size === 0) {
  console.error(`check-bundle: no module scripts found in ${indexPath}`);
  process.exit(1);
}

let total = 0;
for (const ref of refs) {
  const file = join(distDir, ref.replace(/^\//, '').split(/[?#]/)[0]);
  const bytes = gzipSync(readFileSync(file), { level: 9 }).length;
  total += bytes;
  console.log(`  ${bytes.toString().padStart(8)}  ${ref}`);
}

console.log(`initial JS gzip: ${total} bytes (limit ${LIMIT})`);
if (total >= LIMIT) {
  console.error(`check-bundle: FAIL, ${total} >= ${LIMIT}`);
  process.exit(1);
}
