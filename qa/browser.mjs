// Run in a terminal that can launch headless Chromium. No headed fallback.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const shots=path.resolve('shots/browser');await fs.mkdir(shots,{recursive:true});
let browser;
try{browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});}
catch(error){await fs.writeFile('qa/browser-blocked.txt',error.stack);console.error('Headless browser launch blocked. See qa/browser-blocked.txt');process.exit(2);}
const errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8800/');await page.waitForFunction(()=>window.game?.integrationReady,{timeout:60000});await page.screenshot({path:path.join(shots,'join.png')});
 await page.locator('#name').fill('browser_a');await page.locator('#city').selectOption('Kochi');await page.locator('#outfit-cap').selectOption('8');await page.locator('#enter').click();
 await page.waitForFunction(()=>game.joined&&game.network.connected);checks.push('Join and realtime connection');
 const other=await browser.newPage({viewport:{width:1280,height:900}});await other.goto('http://127.0.0.1:8800/?joined=1&name=browser_b&city=Chennai');await other.waitForFunction(()=>window.game?.integrationReady&&game.network.connected,{timeout:60000});
 await page.waitForFunction(()=>game.network.inspect().realCount===2);const start=await page.evaluate(()=>game.player.x);await page.locator('#world-canvas').focus();await page.keyboard.down('d');await page.waitForTimeout(500);await page.keyboard.up('d');assert.ok(await page.evaluate(()=>game.player.x)>start+50);checks.push('Two tabs, immediate keyboard movement and server identity');
 await page.keyboard.press('q');await page.waitForTimeout(120);await page.screenshot({path:path.join(shots,'multiplayer.png')});assert.ok((await other.evaluate(()=>game.network.inspect().quacks.Kochi))>=1);checks.push('Remote city quack aggregation');
 await other.close();await page.evaluate(()=>game.network.close());await page.waitForTimeout(80);
 for(const zone of ['plaza','pond','bread-forest','library','race-lake','lighthouse-beach','islets']){await page.evaluate(zone=>{game.reviewZone(zone);game.paused=true;game.drawFrame(1/60);},zone);await page.screenshot({path:path.join(shots,zone+'.png')});}
 await page.evaluate(()=>{game.overview();game.render();});await page.screenshot({path:path.join(shots,'overview.png')});
 await page.evaluate(()=>{game.reviewZone('plaza');game.follow();game.paused=false;});
 for(const [key,action]of Object.entries({1:2,2:4,3:5,4:6,5:7,6:8,7:9})){await page.keyboard.press(key);await page.waitForTimeout(380);assert.equal(await page.evaluate(()=>game.player.controls.action.value),action);await page.screenshot({path:path.join(shots,'emote-'+key+'.png')});}checks.push('All seven native emote mappings');
 await page.keyboard.press('p');await page.waitForFunction(()=>document.getElementById('photo-dialog').open);await page.screenshot({path:path.join(shots,'photo-mode.png')});
 const download=page.waitForEvent('download');await page.locator('#download-wide').click();await(await download).saveAs(path.join(shots,'photo-wide.png'));await page.locator('#close-photo').click();checks.push('Frozen native postcard and downloadable PNG');
 await page.evaluate(()=>{game.reviewZone('bread-forest');game.activity.start('bread');game.paused=true;game.drawFrame(1/60);});await page.screenshot({path:path.join(shots,'bread-playing.png')});
 await page.evaluate(()=>{for(const b of game.activity.hunt.bread){game.player.x=b.x;game.player.y=b.y;game.simulate(1/60);}for(let i=0;i<28;i++)game.drawFrame(1/60);});assert.equal(await page.evaluate(()=>game.activity.hunt.collected),12);await page.screenshot({path:path.join(shots,'bread-results.png')});
 await page.evaluate(()=>{game.activity.stop();game.reviewZone('race-lake');game.activity.start('race');game.simulate(1/60);for(let i=0;i<20;i++)game.drawFrame(1/60);});await page.screenshot({path:path.join(shots,'race-countdown.png')});
 await page.evaluate(()=>{for(let i=0;i<60*45;i++){if(i%6===0)game.activity.paddle();game.simulate(1/60);}for(let i=0;i<28;i++)game.drawFrame(1/60);});assert.equal(await page.evaluate(()=>game.activity.race.finishOrder.length),8);await page.screenshot({path:path.join(shots,'race-results.png')});checks.push('Activity rules and native results with explicit fixed-step QA clock');
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});await mobile.goto('http://127.0.0.1:8800/?joined=1&name=phone&city=Kochi&quality=low');await mobile.waitForFunction(()=>window.game?.integrationReady,{timeout:60000});await mobile.screenshot({path:path.join(shots,'phone-390.png')});await mobile.touchscreen.tap(250,610);await mobile.waitForTimeout(600);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks.push('Phone viewport, touch tap and no overflow');
 assert.deepEqual(errors,[]);await fs.writeFile('qa/browser-results.json',JSON.stringify({checks,errors,headless:true},null,2));console.log({checks,errors});
}finally{await browser.close();}
