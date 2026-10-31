// @ts-check
/**
 * Fails the build when the first screen grows past its gzip budget. The first screen is every
 * script and stylesheet that web/dist/index.html loads directly (its entry, preloads and CSS);
 * lazy chunks such as the plan view, the profiles and the demo content are
 * left out because they load only when used. Sizes are measured with gzip level 9, close to
 * what a static host serves.
 *
 * Why a budget: the start screen should stay fast on a mid-range phone over a slow mobile
 * connection, and a budget turns an accidental heavy import into a failed check instead of a
 * slow page nobody notices.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/** About 20 % above the measured first screen (46.5 kB gzip when the budget was set). */
const BUDGET_BYTES = 56 * 1024;

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../web/dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');

/** Asset paths referenced by script, modulepreload and stylesheet tags, without the base. */
const ASSET = /(?:src|href)="[^"]*?(assets\/[^"]+\.(?:js|css))"/g;
const assets = [...new Set([...html.matchAll(ASSET)].map((match) => match[1] ?? ''))];

if (assets.length === 0) {
  console.error('size-budget: no scripts or stylesheets found in web/dist/index.html');
  process.exit(1);
}

let total = 0;
for (const asset of assets) {
  const bytes = gzipSync(readFileSync(join(dist, asset)), { level: 9 }).length;
  total += bytes;
  console.log(`${asset.padEnd(40)} ${(bytes / 1024).toFixed(2)} kB gzip`);
}

const summary = `first screen ${(total / 1024).toFixed(2)} kB of ${(BUDGET_BYTES / 1024).toFixed(0)} kB`;
if (total > BUDGET_BYTES) {
  console.error(`size-budget: over budget, ${summary}`);
  process.exit(1);
}
console.log(`size-budget: ok, ${summary}`);
