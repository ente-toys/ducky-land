import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync, writeFileSync} from 'node:fs';
const [base, out, login] = process.argv.slice(2); mkdirSync(out, {recursive: true});
const SPOTS = [['centre', 2820, 2200, .7], ['cider-grove', -783, 1500, .7], ['hay-meadow', 2339, 5333, .7], ['willow-rest', 6428, 3011, .7],
  ['west-picnic', -1289, 4128, .7], ['north-orchard', 928, -400, .7], ['seed-share', 4272, 150, .7], ['close-bay-6150-1800', 6000, 1750, .7],
  ['crossing-1', 3094, 5497, 1], ['crossing-3', 5468, 1390, 1],
  ['bridge-5', 3190, 3560, .8], ['bridge-6', 2150, 3570, .8], ['grove-west-coast', -1800, 1900, .6], ['grove-clover-bank', 4100, 3850, .6], ['grove-east-coast', 7330, 3700, .6], ['butterbill', -389, 222, .7], ['reedwhistle', 5422, 4578, .7], ['overview', 2700, 1900, .13]];
const browser = await chromium.launch({headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (login) await page.goto(`${base}/__test/login?account=boss`);
  await page.goto(`${base}/?${login ? '' : 'offline&'}qa`);
  await page.waitForFunction(() => window.__duckyEngine?.ready || window.__duckyEngine?.initialized, null, {timeout: 120000});
  await page.addStyleTag({content: 'body *{visibility:hidden!important}canvas{visibility:visible!important}'});
  for (const [name, x, y, zoom] of SPOTS) {
    await page.evaluate(([x, y, zoom]) => {const e = window.__duckyEngine; clearInterval(window.__hold); const hold = () => {e.follow = false; e.fitMode = false; e.fly = null; Object.assign(e.camera, {x, y, zoom}); Object.assign(e.target, e.camera); e.quietAt = Infinity;}; hold(); window.__hold = setInterval(hold, 10);}, [x, y, zoom]);
    await page.waitForTimeout(2500);
    await page.screenshot({path: `${out}/${name}.png`});
  }
  const info = await page.evaluate(() => ({sleepers: globalThis.__duckySleepers?.length, dropped: globalThis.__duckySleepersDropped?.length, props: globalThis.__duckyProps?.length}));
  writeFileSync(`${out}/runtime.json`, JSON.stringify({errors, ...info}, null, 2));
  console.log(JSON.stringify({errors: errors.length, ...info}));
} finally {await browser.close();}
