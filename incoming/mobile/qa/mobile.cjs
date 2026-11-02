// Run against python3 serve.py. Actual Chrome touch events, isMobile:true.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = { engine: 'Google Chrome headless, Playwright isMobile:true + hasTouch:true', capturedAt: new Date().toISOString(), checks: [], benchmarks: [] };
async function capture(page, name, width, height, dpr) {
  const bytes = await page.screenshot({path:path.join(ROOT, 'shots', name + '.png')});
  assert.ok(Math.abs(bytes.readUInt32BE(16)-width*dpr)<=1);
  assert.ok(Math.abs(bytes.readUInt32BE(20)-height*dpr)<=1);
}
async function touch(cdp, type, points) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x,y,id])=>({x,y,id,radiusX:4,radiusY:4,force:1})) });
}
(async () => {
  let browser;
  try {
    browser = await chromium.launch({channel:'chrome',headless:true});
    results.browserVersion = browser.version();
    for (const [width,height,dpr] of [[375,812,3],[390,844,3],[412,915,2.625],[768,1024,2],[1024,768,2]]) {
      const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true});
      await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        window.touchEvidence = [];
        addEventListener('pointerdown', e => touchEvidence.push({trusted:e.isTrusted,type:e.pointerType,id:e.pointerId,target:e.target.id}),true);
      });
      await page.goto('http://127.0.0.1:8807/?quality=high');
      await page.waitForFunction(()=>window.game?.ready,undefined,{timeout:30000});
      await page.waitForTimeout(2500);
      assert.equal(await page.evaluate(()=>game.crowdCount+1),13);
      assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[width,height]);
      assert.equal(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches),true);
      await capture(page, `phone-${width}`,width,height,dpr);
      const before = await page.evaluate(()=>({x:game.player.x,y:game.player.y}));
      const target = await page.evaluate(()=>game.toScreen(game.player.x+65,game.player.y+15));
      await page.touchscreen.tap(...target);
      await page.waitForFunction(()=>game.player.path.length===0,undefined,{timeout:5000});
      const after = await page.evaluate(()=>({x:game.player.x,y:game.player.y}));
      assert.ok(after.x > before.x+55,'tap-to-walk arrives');
      const cdp = await context.newCDPSession(page);
      const origin = [80,Math.floor(height*.78),1], moved = [122,Math.floor(height*.78)-18,1];
      await touch(cdp,'touchStart',[origin]);
      await touch(cdp,'touchMove',[moved]); await wait(180);
      const stick = await page.evaluate(()=>({id:game.joystick.id,visible:game.vmi.number('stickOn').value,origin:[game.vmi.number('joystickX').value,game.vmi.number('joystickY').value],x:game.player.x}));
      assert.equal(stick.visible,1); assert.deepEqual(stick.origin,origin.slice(0,2));
      if(width===390) await capture(page,'phone-390-joystick',width,height,dpr);
      const button = await page.locator('#quack').boundingBox(), second = [button.x+button.width/2,button.y+button.height/2,2];
      await touch(cdp,'touchStart',[moved,second]); await wait(60);
      assert.equal(await page.evaluate(()=>game.player.action),2,'quack while walking');
      assert.equal(await page.evaluate(()=>game.joystick.id),stick.id,'second finger does not steal joystick');
      if(width===390) await capture(page,'phone-390-quack',width,height,dpr);
      await touch(cdp,'touchEnd',[moved]); await touch(cdp,'touchEnd',[]); await wait(80);
      assert.equal(await page.evaluate(()=>game.vmi.number('stickOn').value),0);
      const released = await page.evaluate(()=>[game.player.x,game.player.y]); await wait(200);
      assert.deepEqual(await page.evaluate(()=>[game.player.x,game.player.y]),released,'release stops');
      await touch(cdp,'touchStart',[origin]); await touch(cdp,'touchMove',[moved]);
      await touch(cdp,'touchCancel',[]); await wait(60);
      assert.equal(await page.evaluate(()=>game.joystick.id),null,'cancel releases joystick');
      await page.locator('#dance').tap(); await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>game.player.action),3,'dance works');
      assert.equal(await page.locator('#dance').getAttribute('aria-pressed'),'true');
      if(width===390) await capture(page,'phone-390-dance',width,height,dpr);
      await page.locator('#dance').tap();
      assert.equal(await page.evaluate(()=>game.player.action),0,'dance toggles off');
      await page.mouse.wheel(0,500); await wait(100);
      assert.deepEqual(await page.evaluate(()=>[scrollX,scrollY,visualViewport.scale]),[0,0,1]);
      const evidence = await page.evaluate(()=>touchEvidence);
      assert.ok(evidence.length>0 && evidence.every(e=>e.trusted && e.type==='touch'));
      assert.deepEqual(errors,[]);
      results.checks.push({width,height,dpr,pass:true,touchEvidence:evidence,errors});
      // Measure moving player + 12 active crowd Duckies. No screenshots during sampling.
      await page.evaluate(()=>game.startBenchmark());
      await touch(cdp,'touchStart',[origin]); await touch(cdp,'touchMove',[moved]);
      await wait(1500); await touch(cdp,'touchEnd',[]); await wait(6500);
      const bench = await page.evaluate(()=>game.stopBenchmark());
      assert.equal(bench.duckies,13); assert.equal(bench.visibility,'visible'); assert.ok(bench.frameMs.samples>60);
      results.benchmarks.push(bench);
      fs.writeFileSync(path.join(ROOT,'qa',`chrome-${width}.json`),JSON.stringify(bench,null,2));
      if(width===390) {
        // Safe areas are simulated explicitly because desktop Chrome reports zero iOS insets.
        await page.addStyleTag({content:':root{--safe-top:44px;--safe-bottom:34px;--safe-left:0px;--safe-right:0px}'});
        await page.setViewportSize({width:391,height}); await page.setViewportSize({width,height}); await wait(250);
        const safeRect = await page.locator('#actions').boundingBox();
        assert.ok(safeRect.y+safeRect.height <= height-48);
        const visualButtons = await page.evaluate(()=>[game.vmi.number('controlX').value,game.vmi.number('controlY').value]);
        assert.deepEqual(visualButtons,[safeRect.x+29,safeRect.y+22]);
        await capture(page,'phone-390-safearea',width,height,dpr);
        await page.evaluate(()=>game.setQuality('low'));
        await page.waitForFunction(()=>game.ready && game.quality==='low' && game.slots.length===6);
        assert.equal(await page.evaluate(()=>game.crowdCount+1),6);
        await page.locator('#quack').tap(); assert.equal(await page.evaluate(()=>game.player.action),2);
        await capture(page,'phone-390-lite',width,height,dpr);
        await page.evaluate(()=>game.startBenchmark()); await wait(8000);
        const low = await page.evaluate(()=>game.stopBenchmark()); results.benchmarks.push(low);
        fs.writeFileSync(path.join(ROOT,'qa/chrome-lite-390.json'),JSON.stringify(low,null,2));
        // Orientation retains real mobile emulation and never leaves a stale stick.
        await page.setViewportSize({width:844,height:390}); await wait(250);
        assert.equal(await page.evaluate(()=>game.joystick.id),null);
        assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight,scrollX,scrollY]),[844,390,0,0]);
        await capture(page,'phone-landscape',844,390,dpr);
      }
      await context.close();
    }
    const lowContext = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    await lowContext.addInitScript(()=>Object.defineProperty(navigator,'deviceMemory',{get:()=>2}));
    const lowPage = await lowContext.newPage();
    await lowPage.goto('http://127.0.0.1:8807/'); await lowPage.waitForFunction(()=>window.game?.ready);
    assert.equal(await lowPage.evaluate(()=>game.quality),'low','low-memory devices boot native lite');
    results.checks.push({lowMemoryAutoFallback:true}); await lowContext.close();
    fs.writeFileSync(path.join(ROOT,'qa/mobile-results.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results.benchmarks.map(({viewport,duckies,frameMs,riveCpuMs,hostCpuMs,over33ms})=>({viewport,duckies,frameMs,riveCpuMs,hostCpuMs,over33ms})),null,2));
  } catch(error) {
    fs.writeFileSync(path.join(ROOT,'qa/mobile-failure.txt'),error.stack || String(error));
    throw error;
  } finally { if(browser) await browser.close(); }
})();
