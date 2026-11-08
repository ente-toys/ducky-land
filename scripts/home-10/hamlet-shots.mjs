// Hamlet proof: one headless shot per hamlet at game zoom .7, centred on its blueprint frame. Usage: node <this> <base url> <out dir>
import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
const [base, out] = process.argv.slice(2); mkdirSync(out, {recursive: true});
const E = JSON.parse(readFileSync('src/pixi/home-expansion.json'));
const SPOTS = Object.entries(E.hamletFrames).map(([h, f]) => [h, (f[0] + f[2]) / 2, (f[1] + f[3]) / 2, .7]);
const browser = await chromium.launch({headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/?offline&qa`);
  await page.waitForFunction(() => window.__duckyEngine?.ready || window.__duckyEngine?.initialized, null, {timeout: 120000});
  await page.addStyleTag({content: 'body *{visibility:hidden!important}canvas{visibility:visible!important}'});
  for (const [name, x, y, zoom] of [SPOTS[0], ...SPOTS]) {
    await page.evaluate(([x, y, zoom]) => {const e = window.__duckyEngine; e.follow = false; e.fitMode = false; e.fly = null; Object.assign(e.camera, {x, y, zoom}); Object.assign(e.target, e.camera); e.quietAt = Infinity;}, [x, y, zoom]);
    await page.waitForTimeout(3500);
    await page.screenshot({path: `${out}/${name}.png`});
  }
  const info = await page.evaluate(() => ({sleepers: globalThis.__duckySleepers?.length, props: globalThis.__duckyProps?.length}));
  writeFileSync(`${out}/runtime.json`, JSON.stringify({errors, ...info}, null, 2)); console.log(JSON.stringify({errors, ...info}));
} finally {await browser.close();}
