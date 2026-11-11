import {createDuckFeedback} from './feedback.js';
import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import {SLEEP_ASSETS, createSleeper} from './sleeper.js';
import {OUTFIT_OPTIONS} from './outfits.js';
import {createSnowCover} from './snow-cover.js';
import {createKarmaQuiver} from './karma-quiver.js';
import {rinkTilt} from './rink-slide.js';

export const duckAnimationNames=Object.freeze({0:'idle',1:'walk',2:'quack',3:'dance',4:'heart',5:'laugh',6:'wave',7:'sleep',8:'grumpy',9:'party'});
const MANIFEST='/pixi-duck/manifest.json', SCALE=1/3, TAU=Math.PI*2, STUMBLE=.35;
const SNOW_HEAD_REGION = [.19, .81], SNOW_SHOULDER_REGION = [.22, .70];
const slotOrder=['acc','shades','cap','shoes'];
let libraryPromise,liveDucks=0;
const ownedURLs=new Set(),inFlight=new Set();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const safe=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
function loadTexture(url){ownedURLs.add(url);const promise=Assets.load(url);inFlight.add(promise);promise.then(()=>inFlight.delete(promise),()=>inFlight.delete(promise));return promise;}
async function library(){
  if(!libraryPromise)libraryPromise=(async()=>{
    const response=await fetch(MANIFEST);if(!response.ok)throw new Error(`Duck artwork manifest: HTTP ${response.status}`);
    const data=await response.json();
    const sources=new Set(['/pixi-art/karma/golden-feather.svg',...SLEEP_ASSETS,...data.views.flatMap(v=>v.parts.map(p=>p.url))]);
    // SVG geometry and raster textures are independent: do not wait for every
    // image to decode before starting the body-outline requests.
    await Promise.all([
      Promise.all([...sources].map(loadTexture)),
      Promise.all(data.views.map(async view=>{try{view.morph=await bodyShapes(view);}catch{view.morph=null;}})),
    ]);
    return data;
  })().catch(error=>{libraryPromise=undefined;throw error;});
  return libraryPromise;
}
// boss 4 Nov: turning like the Rive rig, the body outline MORPHS between the drawn directions instead of swapping.
// Each direction's body art is sampled once into point rings (body, belly, shine) in the view's ground space.
const RING=120,INK=0x232323,BODY=0xFFD525,BELLY=0xFFE161;
function sampleRing(svg,d){
  const sub=d.split(/(?=M)/).map(x=>x.trim()).filter(Boolean);let best=null;
  for(const part of sub){const el=document.createElementNS('http://www.w3.org/2000/svg','path');el.setAttribute('d',part);svg.appendChild(el);const len=el.getTotalLength();if(!best||len>best.len)best={el,len};}
  const pts=[];for(let i=0;i<RING;i++){const q=best.el.getPointAtLength(best.len*i/RING);pts.push([q.x,q.y]);}
  let area=0;for(let i=0;i<RING;i++){const a=pts[i],b=pts[(i+1)%RING];area+=a[0]*b[1]-b[0]*a[1];}if(area<0)pts.reverse();
  let top=0;for(let i=1;i<RING;i++)if(pts[i][1]<pts[top][1])top=i;
  return pts.slice(top).concat(pts.slice(0,top));
}
async function bodyShapes(view){
  const part=view.parts.find(p=>p.role==='body');if(!part||typeof document==='undefined')return null;
  const text=await (await fetch(part.url)).text(),doc=new DOMParser().parseFromString(text,'image/svg+xml');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.style.cssText='position:absolute;width:0;height:0;visibility:hidden';document.body.appendChild(svg);
  const pick=color=>[...doc.querySelectorAll('path')].find(p=>(p.getAttribute('fill')||'').toLowerCase()===color);
  const [gx,gy]=view.ground,toGround=pts=>pts&&pts.map(([x,y])=>[x-gx,y-gy]);
  const ring=el=>el?toGround(sampleRing(svg,el.getAttribute('d'))):null;
  const out={body:ring(pick('#ffd525')),belly:ring(pick('#ffe161')),shine:ring(pick('white'))};svg.remove();
  return out.body?out:null;
}
/** Shared textures stay alive until the last duck is disposed. Never destroys Texture.WHITE. */
export async function disposeDuckAssets(){
  if(liveDucks)return false;
  await Promise.allSettled([...inFlight]);
  if(liveDucks)return false;
  await Promise.all([...ownedURLs].map(url=>Assets.unload(url)));ownedURLs.clear();libraryPromise=undefined;return true;
}
export async function getDuckWardrobe(){return (await library()).wardrobe;}

function makeJoint(texture,rect,pivot,ground,label){
  const joint=new Container({label});joint.position.set(pivot[0]-ground[0],pivot[1]-ground[1]);
  const sprite=new Sprite(texture);sprite.position.set(rect[0]-pivot[0],rect[1]-pivot[1]);joint.addChild(sprite);
  joint.rest={x:joint.x,y:joint.y};return {joint,sprite};
}
function makeView(spec){
  const root=new Container({label:`Direction ${spec.angle}`}),shadow=new Container(),feet=new Container(),body=new Container(),clothes=new Container(),held=new Container(),behind=new Container(),parts=[];
  root.addChild(shadow,feet,body);body.addChild(behind,clothes);
  for(const part of spec.parts){
    const created=makeJoint(Assets.get(part.url),part.rect,part.pivot,spec.ground,part.id);
    const item={...part,...created};parts.push(item);
    if(part.role==='shadow'){shadow.addChild(created.joint);shadow.visible=false;}   // boss 4 Nov: no dark shade under the belly and legs
    else if(part.role==='foot'||part.role==='toe')feet.addChild(created.joint);
    else body.addChildAt(created.joint,body.children.length-1);
  }
  const bodyIndex=body.children.findIndex(child=>child.label?.startsWith('body-'));
  body.addChildAt(held,bodyIndex+1);
  const bodyPart=parts.find(p=>p.role==='body');let morph=null;
  if(spec.morph&&bodyPart){morph=new Graphics();bodyPart.joint.addChild(morph);bodyPart.sprite.visible=false;}
  const expressions=new Graphics();body.addChildAt(expressions,body.children.length-1);
  const brows=new Graphics();body.addChildAt(brows,body.children.length-1);
  root.visible=false;
  return {root,shadow,feet,body,clothes,held,behind,parts,spec,brows,expressions,morph,bodyPart,garments:[]};
}
const defaultPose=()=>({sqx:1,sqy:1,bob:0,sway:0,lean:0,breath:0,headY:0,headTilt:0,wingL:0,wingR:0,wingForward:0,footL:0,footR:0,stepL:0,stepR:0,bill:0,eye:1,angry:0,tail:0});
function samplePose(action,t,walkPhase,reduced,speed=165){
  const p=defaultPose(),s=Math.sin(t*TAU/2.8),dance=Math.sin(t*TAU/1.35),step=Math.sin(walkPhase);
  p.breath=Math.sin(t*1.8)*.012;p.sway=s*.012;p.headTilt=Math.sin(t*.85)*.014;p.tail=Math.sin(t*2)*.025;
  switch(action){
    case 1:{// boss 4 Nov: smooth Rive-like waddle, no squash: two soft bounces per stride, body rocks onto the standing foot,
      // head, tuft, wings and tail follow a beat late so it reads as many in-between frames
      const k=clamp(speed/165,.7,1.5),c2=walkPhase*2;
      p.bob=-(1-Math.cos(c2))*.5*8*k;p.sway=Math.sin(walkPhase-.35)*.055*k;p.lean=.025*k;
      p.footL=Math.pow(Math.max(0,step),1.3)*17*k;p.footR=Math.pow(Math.max(0,-step),1.3)*17*k;p.stepL=-Math.cos(walkPhase)*26*k;p.stepR=Math.cos(walkPhase)*26*k;   // boss 4 Nov: planted feet: back while down, forward in the air
      p.wingL=-Math.sin(walkPhase+.6)*.12*k-.03;p.wingR=-Math.sin(walkPhase+.6)*.12*k+.03;
      p.headY=-Math.cos(c2-.9)*2.6*k;p.headTilt=-Math.sin(walkPhase-.7)*.028*k;p.tail=-Math.sin(walkPhase-1.1)*.2*k;break;}
    case 2:{const q=Math.max(0,Math.sin(t*TAU/1.1));p.bill=q*.85;p.headY=-q*9;p.bob=3*(1-q);p.wingL=q*.09;p.wingR=-q*.09;break;}
    case 3:p.sway=dance*.13;p.bob=-Math.abs(dance)*12;p.headTilt=-dance*.10;p.wingL=.35+Math.cos(t*5)*.30;p.wingR=-.35+Math.cos(t*5)*.30;p.footL=Math.max(0,-dance)*11;p.footR=Math.max(0,dance)*11;p.tail=dance*.12;break;
    case 4:p.headTilt=.08;p.wingL=.56;p.wingR=-.56;p.wingForward=.12;p.bob=-3*(1+Math.sin(t*3));break;
    case 5:p.bob=-Math.abs(Math.sin(t*15))*6;p.headY=-4;p.headTilt=Math.sin(t*8)*.04;p.bill=.35+Math.abs(Math.sin(t*13))*.45;p.eye=.38;p.wingL=.17;p.wingR=-.17;break;
    case 6:p.wingR=-1.75+Math.sin(t*11)*.26;p.headTilt=-.055;p.sway=.03;break;
    case 8:p.headY=5;p.headTilt=Math.sin(t*2.8)*.035;p.wingL=.28;p.wingR=-.28;p.angry=1;p.footR=Math.max(0,Math.sin(t*9))*7;break;
    case 9:p.bob=-Math.max(0,Math.sin(t*7))*25;p.sway=Math.cos(t*7)*.08;p.wingL=1.45+Math.sin(t*7)*.25;p.wingR=-1.45-Math.sin(t*7)*.25;p.footL=p.footR=Math.max(0,Math.sin(t*7))*10;p.bill=.3;p.headTilt=Math.sin(t*3)*.1;break;
  }
  if(reduced){p.sqx=1+(p.sqx-1)*.12;p.sqy=1+(p.sqy-1)*.12;for(const k of ['bob','sway','lean','breath','headY','headTilt','wingL','wingR','wingForward','footL','footR','stepL','stepR','tail'])p[k]*=.12;p.bill*=.45;}
  return p;
}

/**
 * Original SVG artwork, articulated at source pivots. Root anchor is ground level.
 * `turn` is radians: 0 faces down/front, +PI/2 right, PI back, -PI/2 left.
 * `speed` is world units/second. World position/scale/rotation belong to the caller.
 */
// Permanent NPCs never need the standing rig or its wardrobe.
async function createSleepingDuck(sleep, seed) {
  liveDucks++;
  try {
    await Promise.all(SLEEP_ASSETS.map(loadTexture));
    const root = new Container({label: 'Ducky'});
    const art = new Container({label: 'Sleeping rig'});
    art.scale.set(SCALE);
    root.addChild(art);
    const nap = createSleeper(sleep, seed);
    nap.root.visible = true;
    art.addChild(nap.root);
    nap.update(0, false);
    const snowCover = createSnowCover(seed, true);
    let disposed = false;
    return {
      root,
      update(dt, {time = 0, reducedMotion = false} = {}) {
        if (disposed) return;
        nap.update(time, reducedMotion, snowCover.state.shiver);
        snowCover.render(nap.snowSurfaces);
      },
      snowCover,
      trackSnow: snowCover.track,
      clearSnow: snowCover.clear,
      sleeper: {poke: () => nap.poke(), bounds: () => nap.root.getBounds()},
      setOutfit: async () => {},
      animationNames: duckAnimationNames,
      dispose() {
        if (disposed) return;
        disposed = true;
        liveDucks--;
        snowCover.destroy();
        root.removeFromParent();
        root.destroy({children: true});
      },
    };
  } catch (error) {liveDucks--; throw error;}
}

export async function createDuck({outfit={cap:8,shades:1,acc:0,shoes:2},seed=0,isPlayer=false,sleep=null}={}){
  if (sleep) return createSleepingDuck(sleep, seed);
  liveDucks++;
  let data;
  try{data=await library();}catch(error){liveDucks--;throw error;}
  const root=new Container({label:'Ducky'}),art=new Container({label:'Original SVG rig'});art.scale.set(SCALE);root.addChild(art);
  // boss 6 Nov: a soft ground shadow that shows only during a jump; it stays on the ground, shrinking and fading as the Ducky rises
  const jumpShadow=new Graphics({label:'Jump shadow'}).ellipse(0,0,74,19).fill({color:0x39472D});jumpShadow.visible=false;root.addChildAt(jumpShadow,0);
  const feedback=createDuckFeedback(isPlayer);art.addChild(feedback.ring);
  const views=data.views.map(makeView);art.addChild(views.find(v=>v.spec.angle===0).root);art.addChild(feedback.bubble,feedback.sleep);
  let appearance=null;
  // Arena looks change the existing articulated parts. Texture banks belong to
  // the caller and are shared by every duck, including all eight turn views.
  function setAppearance(next=null){
    if(disposed||appearance===next)return;appearance=next;
    nap.setAppearance?.(next);
    for(const view of views){
      view.morphWeight=undefined;
      for(const part of view.parts){
        part.sprite.texture=next?.textures.get(part.url.split('/').at(-1))??Assets.get(part.url);
        if(part.role==='tail')part.sprite.visible=!next;
      }
      if(next&&!view.devil){
        const tuft=view.parts.find(p=>p.role==='tuft'),tail=view.parts.find(p=>p.role==='tail');
        const horns=new Container({label:'Google devil horns'}),left=new Sprite(next.horn),right=new Sprite(next.horn),spade=new Sprite(next.tail);
        left.anchor.set(.35,.88);right.anchor.set(.35,.88);left.scale.x=-1;horns.addChild(left,right);
        view.body.addChildAt(horns,view.body.getChildIndex(view.bodyPart.joint));
        spade.anchor.set(8/205,210/232);spade.scale.x=tail.side;
        view.body.addChildAt(spade,view.body.getChildIndex(view.bodyPart.joint));
        const tailOffset=Math.abs(view.spec.angle)===180?tail.side*100:0;
        spade.position.set(tail.joint.x+tailOffset,tail.joint.y);
        const radians=view.spec.angle*Math.PI/180,sin=Math.sin(radians),span=30+92*Math.abs(Math.cos(radians));
        const positions=[-1,1].map(side=>({x:side*span,y:side*sin<0?-10*Math.abs(sin):0,k:side*sin<0?1-Math.abs(sin)*.22:1}));
        for(let i=0;i<2;i++){const horn=horns.children[i],p=positions[i];horn.position.set(p.x,p.y);horn.scale.set((i===0?-1:1)*p.k,p.k);}
        horns.position.set(tuft.joint.x-25,tuft.joint.y+27);
        view.devil={horns,spade,tuft,tail,tailOffset,positions};
      }
      if(view.devil){view.devil.horns.visible=Boolean(next);view.devil.spade.visible=Boolean(next);}
    }
    // Combat attaches after the island's update. Repaint the current outline
    // now so the first rendered Google frame cannot flash the yellow palette.
    if(current.root.visible)renderView(current,elapsed);
  }
  const quivers=new Map();
  let karmaEnabled=false,karmaCount=0;
  const setKarma=(total=0)=>{
    karmaEnabled=true;karmaCount=Math.max(0,Math.floor(total));
    if(!quivers.size)for(const view of views)quivers.set(view,createKarmaQuiver(view,Assets.get('/pixi-art/karma/golden-feather.svg')));
  };
  // boss 5 Nov: a sleeping Ducky is one of the 8 approved poses, picked once (placement or seed) so it never rerolls
  const nap = createSleeper(sleep, seed);
  art.addChildAt(nap.root, art.children.length - 2);
  let disposed=false,elapsed=0,actionTime=0,walkPhase=Math.abs(seed)*2.399,currentAction=0,version,turnAngle=0,current=views.find(v=>v.spec.angle===0),outfitVersion=0;
  const snowCover = createSnowCover(seed);
  const snowSurfaces = [
    {parent: current.body, x: 0, y: 0, width: 0, rotation: 0},
    {parent: current.body, x: 0, y: 0, width: 0, rotation: 0},
  ];
  let clothing={...outfit},pose=defaultPose();const phase=Math.abs(seed)*1.618%5;
  // boss 4 Nov: landing settle when a walk stops, a small anticipation when it starts, and a squash-pinch on every turn
  let landT=9,startT=9,turnT=9,lastSpeed=0,arriveT=9,stumbleT=9,stumbleDir={x:-1,y:0},icePhase=null,gait=0,turnLean=0,lastTurn=0,look={x:0,y:0},lookGoal={x:0,y:0},lookAt=2+Math.abs(seed)%3;
  // boss 4 Nov: the Rive 'Arrival Drop' (66 frames at 60 fps): falls in, squashes on touchdown, one small bounce, settles
  const DROP={y:[[0,-1.23],[27,0],[37,-.026],[49,0],[66,0]],sx:[[0,.96],[25,.96],[29,1.18],[39,.98],[49,1],[66,1]],sy:[[0,1.04],[25,1.04],[29,.78],[39,1.04],[49,1],[66,1]]};
  const keyAt=(keys,f)=>{for(let i=1;i<keys.length;i++)if(f<=keys[i][0]){const [f0,a]=keys[i-1],[f1,b]=keys[i],u=(f-f0)/(f1-f0),e=u*u*(3-2*u);return a+(b-a)*e;}return keys.at(-1)[1];};
  const artHeight=art.getLocalBounds().height||900;
  function moveFx(){
    const fx={sqx:1,sqy:1,bob:0,tip:0};
    if(landT<.5){const u=landT/.5;fx.tip=Math.exp(-5*u)*Math.sin(u*Math.PI*2.2)*.06*clamp(lastSpeed/165,.6,1.4);}
    return fx;
  }
  current.root.visible=true;current.root.alpha=1;
  async function setOutfit(next){
    const request=++outfitVersion;
    // boss 4 Nov: only the outfits that wrap the Ducky well stay; a dropped one is swapped for a kept one of the same kind
    const keep=e=>OUTFIT_OPTIONS[e.slot]?.includes(e.index),swap=(slot,index)=>{const all=data.wardrobe.filter(e=>e.slot===slot),hit=all.find(e=>e.index===Number(index)||e.id===index);if(!hit||keep(hit))return hit;const kept=all.filter(keep);return kept[hit.index%kept.length];};
    const entries=Object.entries(next).filter(([slot])=>slot!=='acc'&&slot!=='accessory').map(([slot,index])=>swap(slot,index))   // boss 11 Nov: accessories removed, saved ones are not drawn
      .filter(Boolean).sort((a,b)=>slotOrder.indexOf(a.slot)-slotOrder.indexOf(b.slot));
    const frames=entries.flatMap(entry=>Object.values(entry.frames).flat()).filter(frame=>frame.visible);
    await Promise.all([...new Set(frames.map(frame=>frame.url))].map(loadTexture));
    if(disposed||request!==outfitVersion)return;
    snowCover.clear();
    clothing={...next};
    // sleeping Duckies stay bare for now; their outfits come later
    for(const view of views){
      view.morphWeight = undefined;
      for(const garment of view.garments){garment.mask?.destroy();garment.node.destroy({children:true});}
      view.garments=[];
      for(const part of view.parts){
        if(part.role==='foot'||part.role==='toe')part.joint.visible=!entries.some(e=>e.slot==='shoes');
        if(part.role==='tuft')part.joint.visible=!entries.some(e=>e.slot==='cap'&&![3,12,13].includes(e.sourceNumber));
      }
      for(const entry of entries)for(const frame of entry.frames[String(view.spec.angle)]){
        if(!frame.visible)continue;
        const node=new Container({label:entry.id}),sprite=new Sprite(Assets.get(frame.url));
        const [x,y]=frame.anchor;
        node.position.set(x,y);sprite.position.set(frame.rect[0]-x,frame.rect[1]-y);node.addChild(sprite);
        (frame.layer==='feet'?view.feet:frame.layer==='held'?view.held:frame.layer==='behind'?view.behind:view.clothes).addChild(node);
        // boss 4 Nov: collars and scarves WRAP: drawn a touch wider than the neck and clipped to the (morphing) body outline, so the ends always land on it
        let mask=null;if((frame.attachment==='neck'||frame.wrap)&&view.morph){mask=new Graphics();view.bodyPart.joint.addChild(mask);node.mask=mask;
          const me=view.spec.morph.body,[ox,oy]=[view.bodyPart.joint.rest.x,view.bodyPart.joint.rest.y],ny=frame.rect[1]+Math.min(45,frame.rect[3]/2),band=me.filter(q=>Math.abs(q[1]-ny)<40).map(q=>q[0]);
          const cx=band.length?(Math.min(...band)+Math.max(...band))/2:frame.rect[0]+frame.rect[2]/2,k=frame.wrapScale||1.15;sprite.scale.x=k;sprite.x=cx+(frame.rect[0]-cx)*k-x;}
        // the body's ink line is redrawn over the garment where it crosses the outline, so the cut ends carry the same ink edge
        let ink=null,cut=null;if(mask){cut=new Sprite(sprite.texture);cut.position.copyFrom(sprite.position);cut.scale.copyFrom(sprite.scale);ink=new Graphics();ink.mask=cut;node.addChild(cut,ink);}
        view.garments.push({node,frame,entry,baseX:x,baseY:y,sprite,tex:sprite.texture,cut,ghosts:new Map(),mask,ink,spos:sprite.position.clone(),sscale:sprite.scale.clone()});
      }
    }
  }
  try{await setOutfit(outfit);}catch(error){dispose();throw error;}

  // boss 4 Nov: turning like the Rive rig: between two drawn directions the eyes, beak, wings, tail, tuft and feet glide
  // to where the next direction has them, and the body outline swaps at the halfway point, so a turn has many frames
  const byAngle=[...views].sort((a,b)=>a.spec.angle-b.spec.angle);
  function partMatch(view,other){
    if(view.match?.has(other))return view.match.get(other);
    const map=new Map(),roles=new Set(view.parts.map(p=>p.role));
    for(const role of roles){
      const mine=view.parts.filter(p=>p.role===role).sort((a,b)=>a.joint.rest.x-b.joint.rest.x),theirs=other.parts.filter(p=>p.role===role).sort((a,b)=>a.joint.rest.x-b.joint.rest.x);
      mine.forEach((part,i)=>{const twin=theirs.length===mine.length?theirs[i]:theirs.reduce((best,q)=>!best||Math.abs(q.joint.rest.x-part.joint.rest.x)<Math.abs(best.joint.rest.x-part.joint.rest.x)?q:best,null);map.set(part,twin||null);});
    }
    (view.match||=new Map()).set(other,map);return map;
  }
  let glide={other:null,w:0,lo:false}, sailing=false, seated=false;
  const smooth=(a,b,x)=>{const k=clamp((x-a)/(b-a),0,1);return k*k*(3-2*k);};
  function twinFrame(entry,frame,angle,otherAngle){
    const i=(entry.frames[String(angle)]||[]).indexOf(frame),theirs=entry.frames[String(otherAngle)]||[],t=theirs[i];
    return t&&t.visible&&t.attachment===frame.attachment?t:theirs.find(f=>f.visible&&f.attachment===frame.attachment)||null;
  }
  function renderView(view,t){
    const p=pose,face=Math.abs(view.spec.angle)<=90,lookSide=Math.sign(Math.sin(view.spec.angle*Math.PI/180)),fx=moveFx(),fwdX=Math.sin(view.spec.angle*Math.PI/180),fwdY=Math.cos(view.spec.angle*Math.PI/180)*.35;
    view.body.y=p.bob;view.body.rotation=p.sway+(p.lean+fx.tip)*lookSide+turnLean;view.body.scale.set((1-p.breath*.32)*p.sqx*fx.sqx,(1+p.breath)*p.sqy*fx.sqy);view.body.y+=fx.bob+12;   // boss 4 Nov: belly sits over the top edge of the feet, no dark band between them
    view.shadow.scale.set(1-clamp(-p.bob,0,35)*.005,1);view.shadow.alpha=seated?0:1-clamp(-p.bob,0,35)*.01;
    const blinkAt=(t+phase)%4.8,blink=blinkAt<.14?Math.max(.06,Math.abs(blinkAt-.07)/.07):1;
    const shift={};   // how far each part glided this frame, so the outfit glides with it
    for(const part of view.parts){
      const joint=part.joint,side=part.side;joint.position.set(joint.rest.x,joint.rest.y);joint.rotation=0;joint.scale.set(1);
      if(glide.other&&part.role!=='shadow'){const twin=partMatch(view,glide.other).get(part);
        if(twin){const dx=(twin.joint.rest.x-joint.rest.x)*glide.w,dy=(twin.joint.rest.y-joint.rest.y)*glide.w;joint.x+=dx;joint.y+=dy;shift[part.role+(part.side<0?'L':'R')]=shift[part.role]={x:dx,y:dy};}
        else joint.scale.set(Math.max(0,1-glide.w*2));}
      part.gx=joint.x;part.gy=joint.y;   // glided seat, before pose offsets (eye pieces sit on it)
      if(part.role==='wing'){joint.rotation=side<0?p.wingL:p.wingR;joint.y+=Math.abs(p.sway)*10;}
      if(part.role==='foot'){const lift=side<0?p.footL:p.footR,step=side<0?p.stepL:p.stepR;joint.y-=lift;joint.x+=step*fwdX;joint.y+=step*fwdY;joint.rotation=-side*lift*.005;if(seated){joint.x+=fwdX*24;joint.y-=12;joint.rotation+=side*.12;}}
      if(part.role==='eye'){joint.visible=currentAction!==5;joint.scale.y=Math.min(p.eye,blink);joint.x+=look.x;joint.y+=p.headY+look.y;joint.rotation=p.headTilt+turnLean*.6;}
      if(part.role==='beak'){joint.x+=look.x*1.15;joint.y+=p.headY+look.y;joint.rotation=p.headTilt+turnLean*.6;joint.scale.set(1+p.bill*.08,1+p.bill*1.8);}
      if(part.role==='tuft'){joint.y+=p.headY*.42;joint.rotation=p.headTilt+p.tail*.35;}
      if(part.role==='tail')joint.rotation=p.tail;
      if(part.role==='toe')joint.visible=!clothing.shoes&&currentAction!==1;
    }
    if(appearance&&view.devil){
      const {horns,tuft,positions,spade,tail,tailOffset}=view.devil;
      horns.position.set(tuft.joint.x-25,tuft.joint.y+27);
      horns.rotation=tuft.joint.rotation;
      const otherOffset=glide.other?.devil?.tailOffset??tailOffset;
      spade.position.set(tail.joint.x+tailOffset+(otherOffset-tailOffset)*glide.w,tail.joint.y);
      spade.rotation=tail.joint.rotation;
      spade.scale.x=tail.side+((glide.other?.devil?.tail.side??tail.side)-tail.side)*glide.w;
      for(let i=0;i<2;i++){
        const horn=horns.children[i],p=positions[i],other=glide.other?.devil?.positions[i]??p,w=glide.w,k=p.k+(other.k-p.k)*w;
        horn.position.set(p.x+(other.x-p.x)*w,p.y+(other.y-p.y)*w);horn.scale.set((i===0?-1:1)*k,k);
      }
    }
    // Body geometry depends on the turn, while walking animates its container.
    // Subpixel turn steps avoid rebuilding and triangulating an identical outline.
    const morphWeight = Math.round(glide.w * 128) / 128;
    if(view.morph && (view.morphWeight !== morphWeight || view.morphOther !== glide.other || view.morphSailing !== sailing)){
      view.morphWeight = morphWeight;
      view.morphOther = glide.other;
      view.morphSailing = sailing;
      const me=view.spec.morph,other=glide.other?.spec.morph,w=other?morphWeight:0,[ox,oy]=[view.bodyPart.joint.rest.x,view.bodyPart.joint.rest.y];
      const mix=(a,b,k)=>a.map((p,i)=>[p[0]+((b?b[i][0]:p[0])-p[0])*k-ox,p[1]+((b?b[i][1]:p[1])-p[1])*k-oy]);
      const shrink=(a,k)=>{const cx=a.reduce((s,p)=>s+p[0],0)/a.length,cy=a.reduce((s,p)=>s+p[1],0)/a.length;return a.map(p=>[cx+(p[0]-cx)*k-ox,cy+(p[1]-cy)*k-oy]);};
      const g=view.morph;g.clear();
      const outline=mix(me.body,other?.body,w).flat();g.poly(outline).fill(appearance?.body??BODY).stroke({color:INK,width:9,join:'round'});
      for(const garment of view.garments)if(garment.mask){garment.mask.clear().poly(outline).fill(0xffffff);garment.outline=outline;}
      if(me.belly)g.poly((other&&!other.belly?shrink(me.belly,Math.max(0,1-w*2)):mix(me.belly,other?.belly,w)).flat()).fill(appearance?.belly??BELLY);
      // The white body highlight reads as a cut-out fringe against the cream sail.
      if(me.shine&&!sailing)g.poly((other&&!other.shine?shrink(me.shine,Math.max(0,1-w*2)):mix(me.shine,other?.shine,w)).flat()).fill(0xFFFFFF);
    }
    const eyes=view.parts.filter(part=>part.role==='eye');
    // boss 4 Nov: eye pieces sit on the glided eyes: centred on their midpoint and squeezed by the eye spacing, so 3/4 turns never hang off the head
    const seat=(list,at)=>{if(!list.length)return null;const q=list.map(at),xs=q.map(s=>s.x);return {x:xs.reduce((a,b)=>a+b)/q.length,y:q.reduce((a,s)=>a+s.y,0)/q.length,span:Math.max(...xs)-Math.min(...xs)};};
    const eyeRest=seat(eyes,e=>e.joint.rest),eyeNow=seat(eyes,e=>({x:e.gx,y:e.gy})),eyeOther=glide.other?seat(glide.other.parts.filter(q=>q.role==='eye'),e=>e.joint.rest):null;
    const eyeSpan=!eyeRest?0:eyes.length>1?eyeNow.span:eyeOther&&eyeOther.span>20?eyeOther.span*glide.w:0;
    for(const garment of view.garments){
      const {node,frame}=garment;
      node.position.set(garment.baseX,garment.baseY);node.rotation=0;node.alpha=1;garment.sprite.position.copyFrom(garment.spos);garment.sprite.scale.copyFrom(garment.sscale);
      // boss 4 Nov: head and eye pieces glide to where their OWN frame sits in the next direction (the tuft wanders between
      // drawings and dragged hats off the head), and the two drawings cross-fade with a fixed stacking so the turn never pops
      const headish=frame.attachment==='head'||frame.attachment==='eyes',tf=headish&&glide.other?twinFrame(garment.entry,frame,view.spec.angle,glide.other.spec.angle):null;
      // boss 4 Nov: an outfit with a real drawing at the in-between direction ('22.5', '-157.5'...) shows it, unsqueezed, for the middle
      // of the turn (0.25 to 0.75 of the way), hard swaps both ends; the end drawings no longer squeeze toward the next view
      const mid=(headish||frame.attachment==='neck')&&glide.other?twinFrame(garment.entry,frame,view.spec.angle,glide.mid):null,inMid=mid&&glide.w>=.25;
      garment.sprite.texture=inMid?Assets.get(mid.url):garment.tex;
      for(const [k,ghost] of garment.ghosts)ghost.visible=!!tf&&!mid&&k===glide.other.spec.angle;garment.sprite.alpha=1;
      if(tf||mid&&headish){const u=glide.lo?glide.w:1-glide.w,hm=view.spec.attachments,ho=glide.other.spec.attachments,hx=(ho.head[0]+ho.head[1]-hm.head[0]-hm.head[1])/2,hy=ho.headY-hm.headY;
        node.x+=hx*glide.w;node.y+=hy*glide.w;   // the hat rides the head centre; each drawing keeps its own seat on its own head
        // boss 4 Nov: the hat's outline also grows or narrows toward the next drawing's size and seat, so at the halfway both
        // drawings fill exactly the same box and the swap only changes inner details, never the silhouette
        if(frame.attachment==='head'&&!mid){const w=glide.w,[rx,ry,rw,rh]=frame.rect,[tx,ty,tw,th]=tf.rect,[ax,ay]=frame.anchor;
          garment.sprite.scale.set(1+(tw/rw-1)*w,1+(th/rh-1)*w);garment.sprite.position.set(rx-ax+((tx-hx)-rx)*w,ry-ay+((ty-hy)-ry)*w);}
        if(inMid)garment.sprite.position.set(mid.rect[0]-hx/2-frame.anchor[0],mid.rect[1]-hy/2-frame.anchor[1]);   // drawn on the halfway head
        if(tf&&!mid&&tf.url!==frame.url){let ghost=garment.ghosts.get(glide.other.spec.angle);
          if(!ghost){ghost=new Sprite(Assets.get(tf.url));ghost.position.set(tf.rect[0]-hx-frame.anchor[0],tf.rect[1]-hy-frame.anchor[1]);glide.lo?node.addChild(ghost):node.addChildAt(ghost,0);garment.ghosts.set(glide.other.spec.angle,ghost);}
          const top=smooth(.25,.6,u),bottom=1-smooth(.45,.8,u);ghost.alpha=glide.lo?top:bottom;garment.sprite.alpha=glide.lo?bottom:top;}}
      if(frame.attachment==='eyes'&&eyeRest){
        const fit=(span,s)=>s>1&&span>20?clamp(eyeSpan/span,.05,1.3):1,sx=fit(eyeRest.span,eyes.length);
        node.position.set(eyeNow.x,eyeNow.y);garment.sprite.position.set((frame.rect[0]-eyeRest.x)*sx,frame.rect[1]-eyeRest.y);garment.sprite.scale.x=sx;
        const ghost=tf&&!mid&&glide.other&&garment.ghosts.get(glide.other.spec.angle);
        if(ghost&&eyeOther){const gx=fit(eyeOther.span,glide.other.parts.filter(q=>q.role==='eye').length);ghost.position.set((tf.rect[0]-eyeOther.x)*gx,tf.rect[1]-eyeOther.y);ghost.scale.x=gx;
          // a short swap, the more side-on drawing owning the middle, so two half-faded pairs never stack on the face
          const side=a=>Math.abs(90-Math.abs(a)),otherWins=side(glide.other.spec.angle)<side(view.spec.angle),t=otherWins?glide.w:1-glide.w,win=smooth(.3,.42,t),lose=1-smooth(.38,.48,t);
          ghost.alpha=otherWins?win:lose;garment.sprite.alpha=otherWins?lose:win;}
        if(inMid){const k=.5/glide.w;garment.sprite.position.set(mid.rect[0]-eyeRest.x-(eyeNow.x-eyeRest.x)*k,mid.rect[1]-eyeRest.y-(eyeNow.y-eyeRest.y)*k);garment.sprite.scale.x=1;}   // drawn on the halfway eyes
      }else if(frame.attachment==='eyes')garment.sprite.scale.x=1;
      if(inMid&&frame.attachment==='neck'){const b=shift.body||{x:0,y:0},k=.5/glide.w;garment.sprite.scale.x=1;garment.sprite.position.set(mid.rect[0]-garment.baseX-b.x*k,mid.rect[1]-garment.baseY-b.y*k);}   // drawn on the halfway ghost, so no wrap stretch
      if(garment.cut){garment.cut.texture=garment.sprite.texture;garment.cut.position.copyFrom(garment.sprite.position);garment.cut.scale.copyFrom(garment.sprite.scale);}
      // boss 4 Nov: a head or eye piece with nothing to turn into (the back views) tucks away with its eyes instead of popping at the halfway
      if(headish&&glide.other&&!tf&&!mid){const k=Math.max(0,1-glide.w*2);node.alpha=k;if(frame.attachment==='eyes'&&eyeRest){garment.sprite.scale.x*=k;garment.sprite.x*=k;}}
      // boss 4 Nov: held and worn pieces travel to where the SAME piece sits in the next drawing (no 140-unit snap at the halfway);
      // a piece with no drawing on the same layer there (a guitar from behind, a board going behind the body) fades out before the swap
      let lerp=null;if(!headish&&glide.other&&(frame.attachment==='body'||frame.attachment==='wing')){const on=a=>(garment.entry.frames[String(a)]||[]).filter(f=>f.visible&&f.layer===frame.layer),t=on(glide.other.spec.angle)[on(view.spec.angle).indexOf(frame)];
        if(t)lerp={x:(t.rect[0]+t.rect[2]/2-frame.rect[0]-frame.rect[2]/2)*glide.w,y:(t.rect[1]+t.rect[3]/2-frame.rect[1]-frame.rect[3]/2)*glide.w};else node.alpha=1-smooth(.05,.45,glide.w);}
      const g=lerp?lerp:tf||mid&&headish||(frame.attachment==='eyes'&&eyeRest)?{x:0,y:0}:(frame.attachment==='eyes'?shift.eye||shift.beak:frame.attachment==='head'?shift.tuft||shift.beak:frame.attachment==='foot'?shift['foot'+(frame.side<0?'L':'R')]||shift.foot:frame.attachment==='wing'?shift['wing'+(frame.wingSide<0?'L':'R')]||shift.wing:shift.body)||{x:0,y:0};
      node.x+=g.x;node.y+=g.y;   // boss 4 Nov: dresses glide with the body parts while turning
      if(frame.attachment==='head'||frame.attachment==='eyes'){
        node.x+=frame.attachment==='eyes'?look.x:look.x*.4;node.y+=p.headY;node.rotation=p.headTilt+turnLean*.6;
      }
      if(frame.attachment==='foot'){
        const lift=frame.side<0?p.footL:p.footR,step=frame.side<0?p.stepL:p.stepR;
        node.y-=lift;node.x+=step*fwdX;node.y+=step*fwdY;node.rotation=-frame.side*lift*.005;
      }
      if(frame.attachment==='wing'){
        node.y+=Math.abs(p.sway)*10;node.rotation=frame.wingSide<0?p.wingL:p.wingR;
      }
      if(garment.ink&&garment.outline){const j=view.bodyPart.joint,c=Math.cos(-node.rotation),s=Math.sin(-node.rotation),o=garment.outline,pts=[];
        for(let i=0;i<o.length;i+=2){const dx=o[i]+j.x-node.x,dy=o[i+1]+j.y-node.y;pts.push(dx*c-dy*s,dx*s+dy*c);}
        const previous = garment.inkPoints;
        if (!previous || pts.some((point, i) => Math.abs(point - previous[i]) > .25)) {
          garment.ink.clear().poly(pts).stroke({color:INK,width:16,join:'round'});
          garment.inkPoints = pts;
        }}
      if(frame.attachment==='grip')node.visible=Math.max(Math.abs(p.wingL),Math.abs(p.wingR))<.3;
    }
    // boss 4 Nov: no see-through outfits while turning: each outfit shows only its own drawing, solid, switching at the halfway point
    // with the body; a piece the next direction does not have shrinks away instead of fading
    for(const g of view.garments){for(const gh of g.ghosts.values())gh.visible=false;g.sprite.alpha=1;if(g.node.alpha<1){g.node.scale.set(Math.max(0,g.node.alpha));g.node.alpha=1;}else g.node.scale.set(1);}
    if (currentAction===5 || view.laughing) view.expressions.clear();
    view.laughing=currentAction===5;
    if(currentAction===5)for(const eye of eyes){const {x,y}=eye.joint;view.expressions.moveTo(x-14,y).quadraticCurveTo(x,y-17,x+14,y).stroke({color:0x232323,width:5,cap:'round'});}
    if (p.angry>.02&&face || view.angry) view.brows.clear();
    view.angry=p.angry>.02&&face;
    if(p.angry>.02&&face)for(const eye of eyes){const {x,y}=eye.joint;const side=eye.side;view.brows.moveTo(x-side*17,y-20).lineTo(x+side*14,y-9).stroke({color:0x232323,width:6,alpha:p.angry,cap:'round'});}
  }
  function update(dt,{action=0,speed=0,turn=0,time,reducedMotion=false,emoteVersion,persistentSleep=false,jump=null,sailing:isSailing=false,seated:isSeated=false,ice=null}={}){
    if(disposed)return;dt=clamp(safe(dt),0,.1);elapsed+=dt;
    sailing=isSailing;
    seated=isSeated;
    const next=ice?0:typeof action==='string'?Number(Object.entries(duckAnimationNames).find(([,name])=>name===action)?.[0]||0):Number(action);
    const chosen=Number.isInteger(next)&&next>=0&&next<=9?next:0;
    if(chosen!==currentAction||(emoteVersion!==undefined&&emoteVersion!==version)){if(currentAction===1&&chosen!==1)landT=0;if(chosen===1&&currentAction!==1)startT=0;currentAction=chosen;actionTime=0;version=emoteVersion;}
    landT+=dt;startT+=dt;turnT+=dt;arriveT+=dt;stumbleT+=dt;if(reducedMotion)landT=startT=turnT=9;if(currentAction===1)lastSpeed=safe(speed);
    actionTime+=dt;
    // boss 4 Nov: steps follow the distance walked (one step per 45 world units), and the waddle eases in over two steps and out on stopping
    const walking=currentAction===1,v=walking?Math.max(safe(speed),40):lastSpeed*gait;
    gait+=((walking?1:0)-gait)*(1-Math.exp(-dt/(walking?.22:.16)));
    walkPhase+=dt*v/45*Math.PI*(walking?1:gait);
    const still=samplePose(walking?0:currentAction,actionTime,walkPhase,reducedMotion),stride=samplePose(1,actionTime,walkPhase,reducedMotion,v||165);
    const desired={};for(const key of Object.keys(still))desired[key]=still[key]+(stride[key]-still[key])*(walking||currentAction===0?gait:0);
    const smoothing=1-Math.exp(-dt/0.08);
    for(const key of Object.keys(pose))pose[key]+=(desired[key]-pose[key])*smoothing;
    // lean into turns: tilt toward the inside of the curve, head a touch more
    const turnRate=angleDifference(turnAngle,lastTurn)/Math.max(dt,1e-3);lastTurn=turnAngle;
    turnLean+=(clamp(-turnRate*.035*gait,-.13,.13)*(reducedMotion?0:1)-turnLean)*(1-Math.exp(-dt/.12));
    // idle: eyes and beak glance around together now and then (the beak always moves with the eyes)
    if(!walking&&currentAction===0&&!reducedMotion){lookAt-=dt;if(lookAt<=0){const r=((Math.sin(elapsed*12.9898+phase)*43758.5453)%1+1)%1;lookGoal=r<.4?{x:0,y:0}:{x:(r-.7)*26,y:(r*7%1-.5)*6};lookAt=1.6+r*2.4;}}else lookGoal={x:0,y:0};
    const ls=1-Math.exp(-dt/.09);look.x+=(lookGoal.x-look.x)*ls;look.y+=(lookGoal.y-look.y)*ls;
    turnAngle+=angleDifference(safe(turn),turnAngle)*(1-Math.exp(-dt/.24));   // boss 4 Nov: unhurried turn so the parts are seen moving
    const degrees=turnAngle*180/Math.PI,target=views.reduce((best,v)=>Math.abs(angleDifference(v.spec.angle*Math.PI/180,turnAngle))<Math.abs(angleDifference(best.spec.angle*Math.PI/180,turnAngle))?v:best,current);
    if(target!==current&&Math.abs(angleDifference(current.spec.angle*Math.PI/180,turnAngle))>Math.PI/views.length){
      current.root.visible=false;
      current.root.removeFromParent();
      current=target;
      art.addChildAt(current.root,1);
    }
    // boss 4 Nov: below the first drawn angle the turn pair wraps (180 to -135), so -157.5 is no longer a side profile
    {const a=((degrees%360)+540)%360-180,i=a<byAngle[0].spec.angle?byAngle.length-1:byAngle.findIndex((v,k)=>k===byAngle.length-1||a<byAngle[k+1].spec.angle);
      const lo=byAngle[Math.max(0,i)],hi=byAngle[(Math.max(0,i)+1)%byAngle.length],span=((hi.spec.angle-lo.spec.angle)+360)%360||45,u=clamp((((a-lo.spec.angle)+360)%360)/span,0,1);
      const other=current===lo?hi:current===hi?lo:null;glide=reducedMotion||!other?{other:null,w:0,lo:false}:{other,w:current===lo?u:1-u,lo:current===lo,mid:String(((lo.spec.angle+span/2)%360+540)%360-180)};}
    const t=Number.isFinite(time)?time:elapsed;
    const sleeping = currentAction === 7;
    current.root.visible = !sleeping;
    nap.root.visible = sleeping;
    if (sleeping) nap.update(t, reducedMotion);
    else renderView(current,t);
    if(karmaEnabled)quivers.get(current)?.update(dt,karmaCount,reducedMotion,turnAngle,glide);
    feedback.update(currentAction,actionTime+ (persistentSleep?phase:0),reducedMotion,persistentSleep);
    if (sleeping) {feedback.sleep.visible = false; feedback.bubble.visible = false; feedback.bubble.emoteAction = 0;}   // boss 5 Nov: the pose's own z's, nothing doubles
    if(arriveT<1.1&&!reducedMotion){const f=arriveT*60;art.y=keyAt(DROP.y,f)*artHeight*SCALE;art.scale.set(SCALE*keyAt(DROP.sx,f),SCALE*keyAt(DROP.sy,f));}
    else{art.y=0;art.scale.set(SCALE);}
    art.x=0;art.rotation=0;
    // No balancing animation exists in the rig. Tilt gently over planted feet
    // instead, suppressing the walking gait while momentum carries the duck.
    art.rotation+=rinkTilt(ice,speed,t,reducedMotion);
    // boss 11 Nov: a Ducky sliding off the ice crashes onto the land with the bump stumble
    if(ice?.phase==='crash'&&icePhase!=='crash'){stumbleT=0;stumbleDir={x:-Math.sin(turn),y:-Math.cos(turn)};}
    icePhase=ice?.phase??null;
    // boss 6 Nov: the jump's squash, stretch and lean (player-motion.js jumpPose), scaled about the feet; the caller lifts the root
    jumpShadow.visible=Boolean(jump&&jump.shadow>0&&!sleeping);
    if(jump&&!sleeping){art.scale.x*=jump.sx;art.scale.y*=jump.sy;art.rotation+=jump.rotation;
      if(jumpShadow.visible){jumpShadow.y=jump.lift/(Math.abs(root.scale.y)||1);jumpShadow.scale.set(jump.shadowScale);jumpShadow.alpha=jump.shadow;}}
    // boss 5 Nov: walked into a sleeper, like stepping on a stone: a small hop back, two damped tilt swings, a squash on landing
    if(stumbleT<STUMBLE&&!reducedMotion&&!sleeping){
      const u=stumbleT/STUMBLE,back=u<.3?1-(1-u/.3)**3:1-(.5-.5*Math.cos(Math.PI*(u-.3)/.7)),hop=u<.5?Math.sin(Math.PI*u/.5):0;
      const sq=u>.45&&u<.75?Math.sin(Math.PI*(u-.45)/.3):0,lean=Math.abs(stumbleDir.x)>.2?Math.sign(stumbleDir.x):1;
      art.x=stumbleDir.x*12*back;art.y+=stumbleDir.y*12*back-7*hop;
      art.rotation=lean*4.2*Math.PI/180*Math.exp(-2.2*u)*Math.sin(TAU*u);
      art.scale.x*=1+.07*sq;art.scale.y*=1-.09*sq;
    }
    if (!reducedMotion) art.rotation += snowCover.state.shiver;
    if (snowCover.state.active && root.visible) {
      if (sleeping) snowCover.render(nap.snowSurfaces);
      else {
        const head = snowSurfaces[0], back = snowSurfaces[1], a = current.spec.attachments;
        let hat = null;
        for (const g of current.garments) if (g.entry.slot === 'cap' && g.frame.attachment === 'head') {hat = g; break;}
        if (hat) {
          head.parent = hat.node;
          head.texture = hat.sprite.texture;
          head.spriteX = hat.sprite.x; head.spriteY = hat.sprite.y;
          head.sx = hat.sprite.scale.x; head.sy = hat.sprite.scale.y;
          head.x = hat.sprite.x + hat.frame.rect[2] * hat.sprite.scale.x * .5;
          head.y = hat.sprite.y + 7 * hat.sprite.scale.y;
          head.width = hat.frame.rect[2] * hat.sprite.scale.x * .56;
          head.rotation = 0;
          head.region = null; head.crownKey = undefined; head.ink = 8.8 / Math.abs(head.sx);
        } else {
          const body = current.bodyPart;
          head.texture = body?.sprite.texture;
          head.spriteX = body?.sprite.x || 0; head.spriteY = body?.sprite.y || 0;
          head.sx = body?.sprite.scale.x || 1; head.sy = body?.sprite.scale.y || 1;
          head.region = SNOW_HEAD_REGION; head.crownKey = undefined; head.ink = 8.8;
          const b = glide.other?.spec.attachments, w = b ? glide.w : 0;
          head.parent = body?.joint || current.body;
          head.x = (a.head[0] + a.head[1]) / 2 + (b ? (b.head[0] + b.head[1] - a.head[0] - a.head[1]) / 2 * w : 0) + look.x * .4;
          head.y = a.headY + (b ? (b.headY - a.headY) * w : 0) + pose.headY + 8;
          head.width = (a.head[1] - a.head[0]) * .8;
          head.rotation = pose.headTilt;
        }
        let backWing = null;
        const side = -Math.sin(turnAngle) || -1;
        for (const part of current.parts) if (part.role === 'wing' && (!backWing || part.joint.x * side > backWing.joint.x * side)) backWing = part;
        back.parent = backWing?.joint || current.body;
        back.texture = backWing?.sprite.texture;
        back.spriteX = backWing?.sprite.x || 0; back.spriteY = backWing?.sprite.y || 0;
        back.sx = backWing?.sprite.scale.x || 1; back.sy = backWing?.sprite.scale.y || 1;
        back.x = back.spriteX + (backWing?.rect[2] || 140) * .5;
        back.y = back.spriteY + 8;
        back.width = (backWing?.rect[2] || 140) * .6;
        back.rotation = 0;
        back.region = SNOW_SHOULDER_REGION; back.crownKey = undefined; back.ink = 8.8;
        snowCover.render(snowSurfaces);
      }
    }
    root.duckDirection=degrees;
  }
  function dispose(){
    if(disposed)return;
    disposed=true;
    outfitVersion++;
    liveDucks--;
    snowCover.destroy();
    for(const view of views)if(!view.root.parent)view.root.destroy({children:true});
    root.removeFromParent();
    root.destroy({children:true});
  }
  update(0,{action:sleep ? 7 : 0,persistentSleep:Boolean(sleep)});
  const arrive=()=>{arriveT=0;};
  // away: unit vector pointing away from what was hit, in rig units (x right, y down on screen)
  const stumble=(away={x:-1,y:0})=>{const l=Math.hypot(away.x,away.y)||1;stumbleDir={x:away.x/l,y:away.y/l};stumbleT=0;};
  const sleeper={poke:()=>nap.root.visible&&nap.poke(),bounds:()=>nap.root.getBounds()};   // boss 5 Nov: tap or bump wobbles a sleeper
  const showRing=on=>{feedback.ring.visible=Boolean(isPlayer&&on);};   // boss 5 Nov: no red ring on the deck while sailing or hopping
  return {root,update,dispose,setOutfit,setAppearance,setKarma,karmaTarget:()=>quivers.get(current)?.target??{x:40,y:-110},arrive,stumble,sleeper,showRing,snowCover,trackSnow:snowCover.track,clearSnow:snowCover.clear,animationNames:duckAnimationNames};
}
