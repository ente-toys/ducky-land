import test from 'node:test';
import assert from 'node:assert/strict';
import {themedConstellations} from '../src/pixi/themed-constellations.js';
import {readFileSync} from 'node:fs';
import {astronautAt,blinkingAstronaut} from '../src/pixi/space-ducky.js';
import {createStargazeSky,hashAccount} from '../src/pixi/stargaze-sky.js';
import {DEMO_SKY} from '../src/pixi/stargaze-demo.js';
import {universePosition,projectStar,arrivalPose,cameraBasis,INTRO_MS,DEFAULT_FOV} from '../src/pixi/star-universe.js';

function mounted(width=1200,height=800,reduced=true){
  const previous=new Map(),set=(name,value)=>{previous.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
  let next,backgroundRects=0;
  const context=new Proxy({fillRect(){backgroundRects++;},createRadialGradient(){return {addColorStop(){}};}},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const target=()=>({style:{},dataset:{},events:new Map(),width:0,height:0,hidden:false,offsetWidth:130,offsetHeight:48,
    getBoundingClientRect:()=>({left:0,top:0,width,height}),getContext:()=>context,
    addEventListener(name,fn){this.events.set(name,fn);},removeEventListener(name){this.events.delete(name);},setPointerCapture(){},classList:{add(){},remove(){}}});
  set('document',{createElement:target});set('devicePixelRatio',2);set('matchMedia',()=>({matches:reduced}));set('ResizeObserver',class{observe(){}disconnect(){}});
  set('requestAnimationFrame',fn=>(next=fn,1));set('cancelAnimationFrame',()=>{});
  const canvas=target(),lens=target(),stage=target(),tag=target(),owner=target(),astronaut=target();
  const view=createStargazeSky({canvas,lens,stage,tag,owner,astronaut});view.start();view.setData(DEMO_SKY);
  const frame=(now=performance.now())=>next(now);frame();
  return {view,canvas,lens,tag,owner,astronaut,frame,target:login=>JSON.parse(canvas.dataset.namedTargets).find(s=>s.login===login),rects:()=>backgroundRects,
    restore(){view.dispose();for(const [name,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}};
}

const atRest={x:0,y:0,z:0,yaw:0,pitch:0,fov:DEFAULT_FOV,head:0};
const event=(h,x,y,type='mouse')=>({target:h.canvas,pointerType:type,pointerId:1,clientX:x,clientY:y});
const visibleOther=h=>JSON.parse(h.canvas.dataset.namedTargets).find(s=>s.login!=='you');

test('30,000 unique positions surround the viewer in all directions and distances',()=>{
  const seen=new Set(),sides=Array(8).fill(0);let near=0,far=0;
  for(let i=0;i<30000;i++){
    const seed=hashAccount(i<180?'person:'+(i+1):'anonymous:'+i),p=universePosition(seed);assert.deepEqual(p,universePosition(seed));
    const key=[p.x,p.y,p.z].join(',');assert.ok(!seen.has(key));seen.add(key);
    sides[(p.x>0?1:0)+(p.y>0?2:0)+(p.z>0?4:0)]++;if(p.radius<250)near++;if(p.radius>750)far++;
    assert.ok(p.radius>=55&&p.radius<=1100);
  }
  assert.ok(sides.every(n=>n>2000));assert.ok(near>1000&&far>1000);
});

test('perspective rejects stars behind the viewer and returns to the same view after a full turn',()=>{
  const point={x:80,y:40,z:400},front=projectStar(point,atRest,1200,800);
  assert.equal(front.visible,true);assert.equal(projectStar({x:0,y:0,z:-400},atRest,1200,800).visible,false);
  const back=projectStar(point,{...atRest,yaw:Math.PI},1200,800);assert.equal(back.visible,false);
  const round=projectStar(point,{...atRest,yaw:Math.PI*2},1200,800);assert.ok(Math.hypot(front.x-round.x,front.y-round.y)<1e-8);
  for(const z of [-1,0,1,2])assert.equal(projectStar({x:0,y:0,z},atRest,1200,800).visible,false,'no near-plane wrap or mirror');
});

test('head translation gives near and far stars different parallax',()=>{
  const camera={...atRest,x:8},near={x:10,y:0,z:100},far={x:100,y:0,z:1000};
  const shift=p=>Math.abs(projectStar(p,camera,1200,800).x-projectStar(p,atRest,1200,800).x);
  assert.ok(shift(near)>shift(far)*9);
  assert.notDeepEqual(cameraBasis({...atRest,yaw:.5,head:1}),cameraBasis({...atRest,yaw:0,head:1}));
});

test('arrival uses the same camera projection and lands continuously at the centre',()=>{
  const target={...atRest,yaw:.4,pitch:.1},end=arrivalPose(INTRO_MS,target),before=arrivalPose(INTRO_MS-.001,target);
  assert.equal(end.done,true);for(const k of ['x','y','z','yaw','pitch','fov'])assert.equal(end[k],target[k]);
  const p={x:100,y:20,z:500},a=projectStar(p,end,1200,800),b=projectStar(p,before,1200,800);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.0001);assert.equal(arrivalPose(0,target,true).done,true);
  let previous=Infinity;for(let ms=0;ms<=INTRO_MS;ms+=20){const c=arrivalPose(ms,atRest);assert.ok(Math.abs(c.z)<=previous);previous=Math.abs(c.z);}
});

test('inside view keeps all 30,000 stars, only projects the current direction, and rests without repainting',()=>{
  const h=mounted();try{
    assert.equal(h.canvas.dataset.totalStars,'30000');assert.equal(h.canvas.dataset.spaceMode,'surround-3d');
    assert.equal(Number(h.canvas.dataset.backgroundStars)+Number(h.canvas.dataset.namedStars),30000);
    assert.ok(Number(h.canvas.dataset.visibleStars)>1000&&Number(h.canvas.dataset.visibleStars)<15000);
    assert.ok(Number(h.canvas.dataset.nearStars)>0&&Number(h.canvas.dataset.farStars)>0);
    assert.equal(h.canvas.width,2400);assert.equal(h.canvas.height,1600);
    assert.ok(Math.abs(Number(h.canvas.dataset.ownerX)-600)<4);assert.ok(Math.abs(Number(h.canvas.dataset.ownerY)-400)<4);
    const paints=h.canvas.dataset.paintCount;h.frame();assert.equal(h.canvas.dataset.paintCount,paints);
  }finally{h.restore();}
});

test('drag turns into a different part of the surrounding universe and leaves the owner label accessible',()=>{
  const h=mounted();try{
    const initial=JSON.parse(h.canvas.dataset.camera),before=visibleOther(h);
    h.lens.events.get('pointerdown')(event(h,600,400));h.lens.events.get('pointermove')(event(h,1600,400));h.lens.events.get('pointerup')({...event(h,1600,400),type:'pointerup'});h.frame();
    const after=JSON.parse(h.canvas.dataset.camera);assert.notEqual(after.yaw,initial.yaw);assert.equal(h.owner.dataset.offscreen,'true');assert.equal(h.owner.hidden,false);
    assert.ok(Number.parseFloat(h.owner.style.left)>=65&&Number.parseFloat(h.owner.style.left)<=1135);
    const same=h.target(before.login);assert.ok(!same||Math.hypot(same.x-before.x,same.y-before.y)>50);
    h.view.findMe();h.frame();assert.equal(h.owner.dataset.offscreen,'false');assert.ok(Math.abs(Number(h.canvas.dataset.ownerX)-600)<5);
  }finally{h.restore();}
});

test('picking follows the same 3D camera before and after looking around',()=>{
  const h=mounted();try{
    for(let j=0;j<3;j++){
      const p=visibleOther(h);assert.ok(p);
      h.lens.events.get('pointermove')(event(h,p.x,p.y));h.frame();assert.ok(h.tag.innerHTML.includes('@'+p.login));assert.equal(h.owner.hidden,false);
      h.canvas.events.get('keydown')({key:'ArrowRight',preventDefault(){}});h.frame();
    }
    h.lens.events.get('pointerleave')();h.frame();assert.equal(h.tag.hidden,true);
  }finally{h.restore();}
});

test('touch picks and pointer cancellation never creates a tap',()=>{
  const h=mounted();try{
    const p=visibleOther(h),e=event(h,p.x,p.y,'touch');h.lens.events.get('pointerdown')(e);h.lens.events.get('pointerup')({...e,type:'pointerup'});h.frame();assert.ok(h.tag.innerHTML.includes('@'+p.login));
    h.view.whole();h.frame();h.lens.events.get('pointerdown')(e);h.lens.events.get('pointercancel')({...e,type:'pointercancel'});h.frame();assert.equal(h.tag.hidden,true);
  }finally{h.restore();}
});

test('intro refresh, replay and interruption keep one geometry and a clean motion handoff',()=>{
  const h=mounted(1200,800,false);try{
    assert.equal(h.canvas.dataset.introStars,'30000');h.frame(performance.now()+1600);assert.equal(h.canvas.dataset.intro,'flight');
    const before=JSON.parse(h.canvas.dataset.camera);h.lens.events.get('wheel')({deltaY:0,preventDefault(){}});h.frame();
    const after=JSON.parse(h.canvas.dataset.camera);assert.deepEqual(after,before,'skipping preserves the exact visible camera pose');assert.equal(h.canvas.dataset.intro,'complete');
    const paints=h.canvas.dataset.paintCount;h.frame();assert.equal(h.canvas.dataset.paintCount,paints,'intro trails cannot keep fighting the resting camera');
    h.view.replayIntro();h.frame();h.frame(performance.now()+4500);assert.equal(h.canvas.dataset.intro,'complete');
    assert.equal(h.canvas.dataset.totalStars,'30000');h.view.setData(DEMO_SKY);h.frame(performance.now()+4600);assert.equal(h.canvas.dataset.paintMode,'on-demand');
  }finally{h.restore();}
});

test('phone view retains the full universe and readable own label',()=>{
  const h=mounted(390,844);try{assert.equal(h.canvas.dataset.totalStars,'30000');assert.ok(Number(h.canvas.dataset.visibleStars)>500);assert.equal(h.canvas.width,780);assert.equal(h.canvas.height,1688);assert.ok(Number.parseFloat(h.owner.style.left)>=65&&Number.parseFloat(h.owner.style.left)<=325);}finally{h.restore();}
});


test('camera inertia settles and cannot keep repainting a still universe',()=>{
  const h=mounted(1200,800,false);try{
    h.frame(performance.now()+4500);
    h.lens.events.get('pointerdown')(event(h,700,400));h.lens.events.get('pointermove')(event(h,660,410));h.lens.events.get('pointerup')({...event(h,660,410),type:'pointerup'});
    const now=performance.now()+4600;for(let i=0;i<100;i++)h.frame(now+i*40);
    const count=h.canvas.dataset.paintCount;h.frame(now+4100);assert.equal(h.canvas.dataset.paintCount,count);assert.equal(h.canvas.dataset.paintMode,'on-demand');
  }finally{h.restore();}
});


test('original Figma artwork is preserved while only its existing two eye paths are marked for blinking',()=>{
  const original=readFileSync(new URL('../src/pixi/assets/space-ducky.svg',import.meta.url),'utf8'),animated=blinkingAstronaut(original);
  assert.equal((animated.match(/class="pixi-space-ducky-eye"/g)||[]).length,2);
  assert.equal(animated.replaceAll(' class="pixi-space-ducky-eye"',''),original);
});

test('astronaut flies in world space, has depth, and becomes invisible when looking behind',()=>{
  const anchor={yaw:.2,pitch:.1},p=astronautAt(0,anchor),next=astronautAt(12000,anchor);
  assert.notDeepEqual(next,p);assert.ok(projectStar(p,{...atRest,...anchor},1200,800).visible);
  assert.equal(projectStar(p,{...atRest,...anchor,yaw:anchor.yaw+Math.PI},1200,800).visible,false);
  assert.deepEqual(astronautAt(0,anchor,true),astronautAt(12000,anchor,true));
});

test('astronaut motion does not force repainting the 30,000-star canvas',()=>{
  const h=mounted(1200,800,false);try{
    const now=performance.now();h.frame(now+4500);const before=h.astronaut.style.transform,paints=h.canvas.dataset.paintCount;
    h.frame(now+5500);assert.equal(h.canvas.dataset.paintCount,paints);assert.notEqual(h.astronaut.style.transform,before);assert.equal(h.astronaut.hidden,false);assert.ok(Number(h.astronaut.dataset.depth)>0);
  }finally{h.restore();assert.equal(h.astronaut.hidden,true);}
});


test('island constellations use unique existing stars without changing their 3D positions',()=>{
  const stars=Array.from({length:30000},(_,index)=>({...universePosition(hashAccount('anonymous:'+index)),index})),snapshot=stars.map(s=>[s.x,s.y,s.z]);
  const result=themedConstellations(stars,{yaw:.8,pitch:-.9});assert.deepEqual(result.groups.map(g=>g.name),['duck','boat','telescope']);
  const used=result.groups.flatMap(g=>g.stars);assert.equal(new Set(used).size,used.length);assert.equal(result.lines.length,28);
  for(const [a,b]of result.lines){assert.equal(a,stars[a.index]);assert.equal(b,stars[b.index]);assert.ok((a.x*b.x+a.y*b.y+a.z*b.z)/(a.radius*b.radius)>.9,'lines remain local in the surrounding sphere');}
  assert.deepEqual(stars.map(s=>[s.x,s.y,s.z]),snapshot);
});
