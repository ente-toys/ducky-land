// Run from this folder: node scripts/verify-browser.cjs
// Uses real headless Chrome. Captures the native Rive canvas for 20 seconds.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {chromium}=require('../.tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,
   executablePath:process.env.DUCKY_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
   args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:8808/?seed=2808');
  await page.waitForFunction(()=>window.game&&game.slots.length===32,{timeout:30000});
  assert.equal(await page.evaluate(()=>document.visibilityState),'visible');
  await page.evaluate(()=>{
    const stream=document.getElementById('c').captureStream(30),parts=[];
    const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
    const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});
    window.capturePromise=new Promise(resolve=>{
      recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};
      recorder.onstop=async()=>{const blob=new Blob(parts,{type:mime}),reader=new FileReader();reader.onloadend=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);stream.getTracks().forEach(t=>t.stop());};
    });
    recorder.start(250);setTimeout(()=>recorder.stop(),20000);
  });
  const start=Date.now(),frames=[200,3600,5000,7800,13800,19500];
  const actions=[{ms:4000,run:()=>page.keyboard.press('q')},{ms:8000,run:async()=>{await page.keyboard.down('d');await page.waitForTimeout(500);await page.keyboard.up('d');}},
    {ms:11000,run:()=>page.keyboard.press('e')}];
  const schedule=[...frames.map(ms=>({ms,run:()=>page.screenshot({path:path.join(out,`browser-${String(ms).padStart(5,'0')}.png`)})})),...actions].sort((a,b)=>a.ms-b.ms);
  for(const step of schedule){await page.waitForTimeout(Math.max(0,start+step.ms-Date.now()));await step.run();}
  const encoded=await page.evaluate(()=>capturePromise);
  const webm=path.join(out,'crowd-browser-20s.webm');fs.writeFileSync(webm,Buffer.from(encoded,'base64'));
  const snapshot=await page.evaluate(()=>game.snapshot());
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>({name:x.name,bytes:x.decodedBodySize})));
  const report={browser:await browser.version(),errors,snapshot,resources,recording:webm};
  fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
  assert.equal(errors.length,0,errors.join('\n'));
  for(const type of ['sit','visit','gather','follow','wave','quack','party','dance'])assert(snapshot.events.some(e=>e.type===type),'Missing browser event: '+type);
  const loaded=resources.find(r=>r.name.includes('ducky-land.riv'));
  assert.equal(loaded.bytes,fs.statSync(path.join(root,'rive/web/ducky-land.riv')).size,'Stale Rive file');
  const ff=spawnSync('ffmpeg',['-y','-v','error','-i',webm,'-t','20','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p',path.join(out,'crowd-browser-20s.mp4')],{stdio:'inherit'});
  console.log('Chrome verification passed. Browser frames and 20-second recording:',out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
