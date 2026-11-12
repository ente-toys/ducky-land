import {mkdirSync} from 'node:fs';
const RUNTIME = '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium} = await import(`${RUNTIME}/playwright/index.mjs`);
const [BASE, OUT, ...views] = process.argv.slice(2);
mkdirSync(OUT, {recursive: true});
const browser = await chromium.launch({headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  await page.goto(`${BASE}/?offline&qa`);
  await page.waitForFunction(() => globalThis.__duckyEngine?.ready || globalThis.__duckyEngine?.initialized, null, {timeout: 120000});
  await page.waitForTimeout(2500);
  await page.addStyleTag({content: 'body *{visibility:hidden!important}canvas,#grid,#grid *{visibility:visible!important}'});
  for (const v of views) {
    const [x, y, zoom, step = 250] = v.split(',').map(Number);
    await page.evaluate(([x, y, zoom, step]) => {
      const e = globalThis.__duckyEngine; e.follow = false; e.fitMode = false; e.fly = null; Object.assign(e.camera, {x, y, zoom}); Object.assign(e.target, e.camera); e.quietAt = Infinity;
      document.getElementById('grid')?.remove();
      const W = 1440, H = 900, x0 = x - W / 2 / zoom, y0 = y - H / 2 / zoom;
      let s = `<svg id="grid" style="position:fixed;left:0;top:0;z-index:99;pointer-events:none" width="${W}" height="${H}">`;
      for (let gx = Math.ceil(x0 / step) * step; gx < x0 + W / zoom; gx += step) {const sx = (gx - x0) * zoom; s += `<line x1="${sx}" y1="0" x2="${sx}" y2="${H}" stroke="#f0f" stroke-opacity=".45"/><text x="${sx + 2}" y="12" font-size="11" fill="#fff" stroke="#000" stroke-width=".4">${gx}</text>`;}
      for (let gy = Math.ceil(y0 / step) * step; gy < y0 + H / zoom; gy += step) {const sy = (gy - y0) * zoom; s += `<line x1="0" y1="${sy}" x2="${W}" y2="${sy}" stroke="#f0f" stroke-opacity=".45"/><text x="2" y="${sy - 2}" font-size="11" fill="#fff" stroke="#000" stroke-width=".4">${gy}</text>`;}
      document.body.insertAdjacentHTML('beforeend', s + '</svg>');
    }, [x, y, zoom, step]);
    await page.waitForTimeout(3000);
    await page.screenshot({path: `${OUT}/grid-${x}-${y}-${zoom}.png`});
  }
} finally {await browser.close();}
