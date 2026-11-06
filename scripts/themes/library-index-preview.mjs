// Prints what scripts/theme-index.mjs would write to rive/web/themes/index.js, with the JSON inlined, WITHOUT writing it.
// A headless QA page serves this in place of index.js (Playwright route), so the themed islands can be looked at while the
// live index is held back. Usage: node scripts/themes/library-index-preview.mjs > out.js
import {readFileSync} from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
const J = f => readFileSync(f, 'utf8');
const lines = ['export default {'];
for (const theme of ['sunflower', 'pink', 'library']) {
  const r = checkTheme(theme);
  if (!r.ready) {console.error(theme, 'not ready', r.problems.slice(0, 2)); continue;}
  const d = `rive/web/themes/${theme}/`;
  let walk = 'null'; try {walk = J(d + 'walk-world.json');} catch {}
  lines.push(`  ${theme}: {world: ${J(d + 'world.json')}, walk: ${walk}, harbor: ${J(d + 'harbor.json')}, art: '/pixi-art/themes/${theme}/art.json', sea: ${JSON.stringify(r.sea)}, sleepers: ${JSON.stringify(r.sleepers)}},`);
}
lines.push('};');
console.log(lines.join('\n'));
