// usage: node shot.mjs port prefix name=cam [name=cam ...]   (cam = x,y,zoom)
import {createRequire} from 'node:module';
const require = createRequire('/Users/pragadees.xd/.framer-qa/node_modules/');
const {chromium} = require('playwright');
const [port, prefix, ...shots] = process.argv.slice(2);
const browser = await chromium.launch({args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
for (const s of shots) {
  const [name, cam] = s.split('=');
  const page = await browser.newPage({viewport: {width: 1600, height: 1100}, deviceScaleFactor: 1});
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${port}/?offline&cam=${cam}`, {waitUntil: 'load'});
  await page.waitForTimeout(10000);
  const info = await page.evaluate(() => ({sleepers: globalThis.__duckySleepers?.length, dropped: globalThis.__duckySleepersDropped?.length, props: globalThis.__duckyProps?.length}));
  await page.screenshot({path: `${prefix}${name}.png`});
  console.log(name, JSON.stringify(info), errs.join(' | '));
  await page.close();
}
await browser.close();
