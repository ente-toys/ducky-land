const {chromium}=require('/Users/pragadees.xd/.framer-qa/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true}), page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:8801/');
 await page.waitForFunction(()=>window.game?.ready||window.gameError,{timeout:30000});await page.waitForTimeout(2000);
 console.log(JSON.stringify({errors,state:await page.evaluate(()=>window.game?{ready:game.ready,frames:game.frames,fps:game.fps,ducks:game.ducks.length,props:game.props.length,player:{x:game.player.x,y:game.player.y},bounds:game.player.art.bounds,frameOrigin:game.player.art.frameOrigin}:window.gameError)}));
 await page.screenshot({path:'shots/plaza-first.png'});
 await page.goto('http://127.0.0.1:8801/?view=overview');await page.waitForFunction(()=>window.game?.ready||window.gameError);await page.waitForTimeout(1000);await page.screenshot({path:'shots/overview-first.png'});
 await browser.close();
})();
