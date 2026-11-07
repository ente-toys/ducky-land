import {butterflyPose} from '../src/pixi/butterflies.js';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {OUTFIT_OPTIONS} from '../src/pixi/outfits.js';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {floatingPose} from '../src/pixi/floating.js';
import {Gestures, movePinch, screenToWorld} from '../src/pixi/camera.js';
import {createSimulation} from '../src/pixi/simulation.js';

test('all 28 NPCs remain asleep through greetings and quacks while the player can move', () => {
  const world = JSON.parse(readFileSync(new URL('../rive/web/world.json', import.meta.url)));
  const sim = createSimulation(world, 8612, {sleepingNpcs: true});
  const sleeping = sim.ducks.filter(duck => !duck.player);
  const positions = sleeping.map(duck => [duck.x, duck.y, duck.turn]);
  assert.equal(sleeping.length, 28);
  assert.equal(sim.player.sleeping, false);
  assert.equal(sim.player.action, 0);
  for (let frame = 0; frame < 3600; frame++) {
    if (frame % 90 === 0) {
      sim.emote(2);
      sleeping.forEach(duck => sim.emote(6, duck));
    }
    sim.step(1 / 60);
  }
  for (const [i, duck] of sleeping.entries()) {
    assert.equal(duck.action, 7);
    assert.equal(duck.sleeping, true);
    assert.equal(duck.travel, 0);
    assert.equal(duck.path.length, 0);
    assert.deepEqual([duck.x, duck.y, duck.turn], positions[i]);
  }
  const start = sim.player.x;
  sim.step(1 / 60, {x: 1, y: 0});
  assert.ok(sim.player.x > start);
  assert.equal(sim.player.action, 1);
  assert.ok(sim.destination(sim.player.x + 100, sim.player.y));
  sim.emote(7);
  sim.step(1 / 60, {x: 1, y: 0});
  assert.equal(sim.player.action, 1, 'player can interrupt their own sleep emote');
});

test('pinch keeps its world anchor while translating, zooming, and hitting zoom limits', () => {
  for (const ratio of [.01, .6, 1.8, 30]) {
    const camera = {x: 2820, y: 2410, zoom: .6};
    const before = [{x: 100, y: 180}, {x: 300, y: 280}];
    const after = [{x: 260-100*ratio, y: 300-50*ratio}, {x: 260+100*ratio, y: 300+50*ratio}];
    const anchor = screenToWorld(camera, {x: 200, y: 230}, 390, 844);
    movePinch(camera, before, after, .1, 1.65, 390, 844);
    const result = screenToWorld(camera, {x: 260, y: 300}, 390, 844);
    assert.ok(Math.abs(result.x-anchor.x)<1e-8 && Math.abs(result.y-anchor.y)<1e-8);
    assert.ok(camera.zoom>=.1 && camera.zoom<=1.65);
  }
});

test('cancelled, dragged, and multi-touch pointers never become taps', () => {
  const gestures = new Gestures();
  gestures.down(1, {x: 100, y: 100});
  gestures.move(1, {x: 104, y: 102});
  assert.deepEqual(gestures.up(1), {x: 104, y: 102});
  gestures.down(1, {x: 100, y: 100});
  gestures.move(1, {x: 120, y: 100});
  gestures.move(1, {x: 100, y: 100});
  assert.equal(gestures.up(1), null);
  gestures.down(1, {x: 100, y: 100});
  gestures.down(2, {x: 110, y: 100});
  assert.equal(gestures.up(2), null);
  assert.equal(gestures.up(1), null);
  gestures.down(3, {x: 100, y: 100});
  assert.equal(gestures.up(3, true), null);
  gestures.down(1, {x: 100, y: 100});
  gestures.clear();
  assert.equal(gestures.up(1), null);
});

test('original island art has complete placements, valid clipped SVGs and GPU-safe ground tiles', () => {
  const art = JSON.parse(readFileSync(new URL('../src/pixi/art-manifest.json', import.meta.url)));
  const world = JSON.parse(readFileSync(new URL('../rive/web/world.json', import.meta.url)));
  assert.equal(art.props.length, world.props.length);
  const parser = new (new JSDOM('').window.DOMParser)();
  for (const item of [...art.props, ...art.ground.tiles, ...art.floating]) {
    const text = readFileSync(new URL(`../public${item.src}`, import.meta.url), 'utf8');
    const svg = parser.parseFromString(text, 'image/svg+xml');
    assert.equal(svg.querySelector('parsererror'), null, item.src);
    assert.ok(svg.querySelector('path,ellipse,rect'), item.src);
    assert.ok(item.width > 0 && item.height > 0);
    for (const match of text.matchAll(/url\(#([^\)]+)\)/g)) assert.ok(svg.getElementById(match[1]), `${item.src}: missing clip ${match[1]}`);
  }
  for (const [i, prop] of art.props.entries()) {
    assert.equal(prop.artboard, world.props[i].artboard);
    assert.equal(prop.x, world.props[i].x);
    assert.equal(prop.y, world.props[i].y);
    assert.ok(Number.isFinite(prop.anchor.x) && Number.isFinite(prop.anchor.y));
  }
  let area = 0;
  for (const tile of art.ground.tiles) {
    assert.ok(tile.width <= 1536 && tile.height <= 1536);
    area += tile.width * tile.height;
  }
  assert.equal(area, world.width * world.height);
});

test('all 34 wearables cover eight measured directions without missing or clipped artwork', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/pixi-duck/manifest.json', import.meta.url)));
  const parser = new (new JSDOM('').window.DOMParser)();
  assert.equal(manifest.wardrobe.length, 34);
  for(const view of manifest.views)for(const wing of view.parts.filter(part=>part.role==='wing')){
    const x=wing.pivot[0]-view.ground[0];
    assert.ok(x>view.attachments.neckTop[0]&&x<view.attachments.neckTop[1], 'wing hinge remains inside the shoulder');
  }
  const drawn = manifest.views.map(view => String(view.angle));
  const inBetween = new Set(['22.5', '67.5', '112.5', '157.5', '-22.5', '-67.5', '-112.5', '-157.5']);
  const checkFrame = frame => {
    assert.ok(frame.rect.every(Number.isFinite));
    assert.ok(frame.anchor.every(Number.isFinite));
    assert.ok(frame.rect[2] > 0 && frame.rect[3] > 0);
    const text = readFileSync(new URL(`../public${frame.url}`, import.meta.url), 'utf8');
    const svg = parser.parseFromString(text, 'image/svg+xml');
    assert.equal(svg.querySelector('parsererror'), null, frame.url);
    for (const match of text.matchAll(/url\(#([^\)]+)\)/g)) assert.ok(svg.getElementById(match[1]), frame.url);
  };
  for (const entry of manifest.wardrobe) {
    if (!OUTFIT_OPTIONS[entry.slot]?.includes(entry.index)) continue;
    for (const angle of drawn) assert.ok(entry.frames[angle], `${entry.id} ${angle}`);
    for (const key of Object.keys(entry.frames)) {
      if (drawn.includes(key)) continue;
      assert.ok(inBetween.has(key), `${entry.id} unexpected direction ${key}`);
      assert.ok(entry.frames[key]?.length, `${entry.id} ${key}`);
      for (const frame of entry.frames[key]) checkFrame(frame);
    }
    for (const view of manifest.views) {
      const frames = entry.frames[String(view.angle)];
      assert.ok(frames?.length, `${entry.id} ${view.angle}`);
      for (const frame of frames) checkFrame(frame);
      if (entry.slot === 'shoes') {
        const feet = view.parts.filter(part => part.role === 'foot');
        assert.equal(frames.length, feet.length);
        for (const frame of frames) {
          const foot = feet.find(part => part.side === frame.side);
          assert.ok(foot);
          // boss 4 Nov: shoes were refit to sit snug on the foot, a few units above the joint; they stay pinned to that foot
          const pin = foot.pivot.map((value, i) => value - view.ground[i]);
          assert.ok(frame.anchor.every((value, i) => Math.abs(value - pin[i]) <= 10), 'shoe stays pinned to its foot');
          assert.equal(frame.layer, 'feet');
          assert.ok(frame.rect[1] + frame.rect[3] <= 14, 'shoe rests on the shadow baseline');
        }
      }
      if (entry.slot === 'acc' && [4, 9, 11].includes(entry.sourceNumber)) {
        const [left, right] = view.attachments.neckTop;
        const frame = frames[0];
        assert.ok(frame.rect[0] <= left, 'neckwear reaches the left silhouette');
        assert.ok(frame.rect[0] + frame.rect[2] >= right, 'neckwear reaches the right silhouette');
        if (entry.sourceNumber === 9) assert.ok(frame.rect[3] >= 90, 'scarf retains its fabric width');
      }
      // shades show wherever eyes show; from behind they are hidden or a separate back drawing (just the arms), never the lenses
      if (entry.slot === 'shades') {
        if (view.parts.some(part => part.role === 'eye')) assert.ok(frames[0].visible, 'shades show over the eyes');
        else assert.ok(!frames[0].visible || frames[0].url !== entry.frames['0'][0].url, 'lenses never show from behind');
      }
      if (entry.slot === 'acc' && [6, 8].includes(entry.sourceNumber) && Math.abs(view.angle) > 90) {
        assert.equal(frames[0].layer, 'behind');
        assert.equal(frames[0].visible, true, 'handheld object can peek beyond the body');
      }
    }
  }
});

test('corrected caps leave both eyes clear in every facing that shows a face', async () => {
  const {createCanvas,loadImage}=await import('@napi-rs/canvas');
  const manifest=JSON.parse(readFileSync(new URL('../public/pixi-duck/manifest.json',import.meta.url)));
  for(const id of ['cap-8','cap-9','cap-11']){
    const entry=manifest.wardrobe.find(item=>item.id===id);
    for(const view of manifest.views){
      const eyes=view.parts.filter(part=>part.role==='eye');
      if(!eyes.length)continue;
      const frame=entry.frames[String(view.angle)][0];
      const canvas=createCanvas(frame.rect[2],frame.rect[3]),context=canvas.getContext('2d');
      context.drawImage(await loadImage(fileURLToPath(new URL(`../public${frame.url}`,import.meta.url))),0,0);
      for(const eye of eyes){
        const x=Math.round(eye.pivot[0]-view.ground[0]-frame.rect[0]);
        const y=Math.round(eye.pivot[1]-view.ground[1]-frame.rect[1]);
        if(x<0||y<0||x>=canvas.width||y>=canvas.height)continue;
        assert.ok(context.getImageData(x,y,1,1).data[3]<32,`${id} ${view.angle} covers an eye`);
      }
    }
  }
});

test('all eleven extracted lilies drift within their pond positions and respect reduced motion', () => {
  const art=JSON.parse(readFileSync(new URL('../src/pixi/art-manifest.json',import.meta.url)));
  assert.equal(art.floating.length,11);
  for(const item of art.floating){
    assert.notDeepEqual(floatingPose(item,0),floatingPose(item,10));
    for(let t=0;t<120;t+=.5){
      const pose=floatingPose(item,t);
      assert.ok(Math.abs(pose.x-item.x)<=9.001);
      assert.ok(Math.abs(pose.y-item.y)<=5.201);
      assert.ok(Math.abs(pose.rotation)<=.035001);
      assert.deepEqual(floatingPose(item,t,true),{x:item.x,y:item.y,rotation:0});
    }
  }
  const ground=readFileSync(new URL('../public/pixi-art/ground.svg',import.meta.url),'utf8');
  assert.ok(!ground.includes('data-name="Lotus petal'), 'flowers must not remain baked into the ground');
});

test('butterflies flutter near their planters and settle under reduced motion',()=>{
  const initial=butterflyPose(2230,2280,1,0);
  assert.notDeepEqual(initial,butterflyPose(2230,2280,1,3));
  for(let t=0;t<60;t+=.1){
    const pose=butterflyPose(2230,2280,1,t);
    assert.ok(Math.abs(pose.x-2230)<=44.001&&Math.abs(pose.y-2280)<=20.001);
    assert.ok(pose.flap>=.239&&pose.flap<=.961);
    assert.deepEqual(butterflyPose(2230,2280,1,t,true),{x:2230,y:2280,rotation:0,flap:1});
  }
});

test('rendered paths connect every district and mainland bridge approach', async()=>{
  const {createCanvas,loadImage}=await import('@napi-rs/canvas');
  const world=JSON.parse(readFileSync(new URL('../rive/web/world.json',import.meta.url)));
  const canvas=createCanvas(world.width/4,world.height/4),ctx=canvas.getContext('2d');
  ctx.drawImage(await loadImage(fileURLToPath(new URL('../public/pixi-art/ground.svg',import.meta.url))),0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const paved=index=>{const [r,g,b,a]=pixels.subarray(index*4,index*4+4);return a>200&&((r>210&&g>185&&b>110)||(r>130&&Math.abs(r-g)<25&&Math.abs(b-g)<25));};
  const indexAt=(x,y)=>Math.round(y/4)*canvas.width+Math.round(x/4);
  const start=indexAt(2030,2050),visited=new Uint8Array(canvas.width*canvas.height),queue=new Int32Array(visited.length);
  assert.ok(paved(start),'main route start is paved');
  const surface=new Uint8Array(canvas.width*canvas.height);
  for(let i=0;i<surface.length;i++)surface[i]=Number(paved(i));
  const traversable=index=>{
    if(surface[index])return true;
    const x=index%canvas.width,y=Math.floor(index/canvas.width);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(x+dx>=0&&x+dx<canvas.width&&y+dy>=0&&y+dy<canvas.height&&surface[index+dy*canvas.width+dx])return true;
    }
    return false;
  };
  let read=0,write=1;queue[0]=start;visited[start]=1;
  while(read<write){
    const index=queue[read++],x=index%canvas.width,y=Math.floor(index/canvas.width);
    for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){
      const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=canvas.width||ny>=canvas.height)continue;
      const next=ny*canvas.width+nx;if(!visited[next]&&traversable(next)){visited[next]=1;queue[write++]=next;}
    }
  }
  const destinations=[['woods',1450,1970],['library',2920,1700],['pond',1740,2970],['race lake',4150,1910],['beach',4700,2860]];
  for(const [i,bridge]of world.walkways.entries()){
    const dx=bridge.b[0]-bridge.a[0],dy=bridge.b[1]-bridge.a[1],length=Math.hypot(dx,dy);
    destinations.push([`bridge ${i+1}`,bridge.a[0]-dx/length*70,bridge.a[1]-dy/length*70]);
  }
  for(const [name,x,y]of destinations){
    assert.ok(paved(indexAt(x,y)),`${name}: approach must be paved`);
    assert.ok(visited[indexAt(x,y)],`${name}: pavement must connect to the plaza`);
  }
});

test('detailed asset variants preserve dimensions, anchors, masks, and self-contained paint references',()=>{
  const art=JSON.parse(readFileSync(new URL('../src/pixi/art-manifest.json',import.meta.url)));
  const library=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));
  const parser=new (new JSDOM('').window.DOMParser)();
  assert.equal(Object.keys(art.enhancedAssets).length,library.assets.length);
  for(const asset of library.assets){
    const original=parser.parseFromString(readFileSync(new URL(`../${asset.file}`,import.meta.url),'utf8'),'image/svg+xml');
    const text=readFileSync(new URL(`../public${art.enhancedAssets[asset.file]}`,import.meta.url),'utf8');
    const detailed=parser.parseFromString(text,'image/svg+xml');
    assert.equal(detailed.querySelector('parsererror'),null,asset.name);
    assert.equal(detailed.documentElement.getAttribute('data-detail'),'1');
    for(const attr of ['viewBox','width','height'])assert.equal(detailed.documentElement.getAttribute(attr),original.documentElement.getAttribute(attr),`${asset.name}: ${attr}`);
    for(const match of text.matchAll(/url\(#([^\)]+)\)/g))assert.ok(detailed.getElementById(match[1]),`${asset.name}: missing paint or mask ${match[1]}`);
    assert.equal(detailed.querySelectorAll('mask,clipPath').length,original.querySelectorAll('mask,clipPath').length,`${asset.name}: masking preserved`);
    for(const mask of detailed.querySelectorAll('mask,clipPath'))assert.equal(mask.querySelector('[fill^="url(#light-"]'),null,`${asset.name}: mask luminance must stay unchanged`);
  }
});

test('all original emote bubbles appear, expire, and retain feedback under reduced motion',async()=>{
  const {bubblePose,createDuckFeedback}=await import('../src/pixi/feedback.js');
  for(const [action,duration]of [[2,1.3],[4,1.5],[5,1.55],[6,1.55],[7,2.3],[8,1.5],[9,1.75]]){
    assert.equal(bubblePose(action,0).visible,false);
    assert.equal(bubblePose(action,.3).visible,true);
    assert.equal(bubblePose(action,.3,true).visible,true);
    assert.equal(bubblePose(action,duration).visible,false);
  }
  for(const action of [0,1,3])assert.equal(bubblePose(action,.3).visible,false);
  const player=createDuckFeedback(true),npc=createDuckFeedback(false);
  assert.equal(player.ring.visible,true);assert.equal(npc.ring.visible,false);
  for(const feedback of [player,npc]){
    feedback.update(2,.3,false);assert.equal(feedback.bubble.emoteAction,2);
    feedback.update(1,.1,false);assert.equal(feedback.bubble.visible,false);
    feedback.ring.destroy();feedback.bubble.destroy({children:true});feedback.sleep.destroy({children:true});
  }
});

test('persistent sleep indicators remain visible and stop drifting with reduced motion',async()=>{
  const {createDuckFeedback}=await import('../src/pixi/feedback.js');
  const feedback=createDuckFeedback(false);
  try {
    for(const time of [.1,3,60,600]){
      feedback.update(7,time,false,true);
      assert.equal(feedback.sleep.visible,true);
      assert.equal(feedback.bubble.visible,false);
    }
    feedback.update(7,10,true,true);
    const positions=feedback.sleep.children.map(z=>[z.x,z.y,z.alpha]);
    feedback.update(7,50,true,true);
    assert.deepEqual(feedback.sleep.children.map(z=>[z.x,z.y,z.alpha]),positions);
    feedback.update(0,0,false,false);
    assert.equal(feedback.sleep.visible,false);
  } finally {feedback.ring.destroy();feedback.bubble.destroy({children:true});feedback.sleep.destroy({children:true});}
});

test('clouds drift continuously through the world and wind respects reduced motion',async()=>{
  const {cloudPose,windStrength}=await import('../src/pixi/weather.js');
  const cloud={x:2300,y:1850,speed:8,phase:0};
  assert.ok(cloudPose(cloud,10,5800).x>cloudPose(cloud,0,5800).x);
  for(let time=0;time<2000;time+=7){
    const pose=cloudPose(cloud,time,5800);assert.ok(pose.x>=-500&&pose.x<6300);assert.ok(Math.abs(pose.y-cloud.y)<=18);
    assert.ok(windStrength(time)>=.35&&windStrength(time)<=1);
    assert.equal(windStrength(time,true),0);assert.deepEqual(cloudPose(cloud,time,5800,true),cloudPose(cloud,0,5800,true));
  }
});
