import {createDuckFeedback} from './feedback.js';
import { Assets, Container, Graphics, Sprite } from 'pixi.js';

export const duckAnimationNames=Object.freeze({0:'idle',1:'walk',2:'quack',3:'dance',4:'heart',5:'laugh',6:'wave',7:'sleep',8:'grumpy',9:'party'});
const MANIFEST='/pixi-duck/manifest.json', SCALE=1/3, TAU=Math.PI*2;
const NAP_POSES = [
  {name:'Tucked rest', url:'/pixi-duck/tucked-rest.svg', view:0, hat:[0,-293,0], shadow:236, z:[132,-445]},
  {name:'Head under wing', url:'/pixi-duck/head-under-wing.svg', view:90, hat:[62,-286,.12], shadow:245, z:[156,-438]},
  {name:'Side nap', url:'/pixi-duck/side-nap.svg', view:-90, hat:[-157,-227,-.24], shadow:264, z:[-152,-390]},
];
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
    await Promise.all([...NAP_POSES.map(pose => loadTexture(pose.url)), ...data.views.flatMap(v=>v.parts.map(p=>loadTexture(p.url)))]);
    return data;
  })().catch(error=>{libraryPromise=undefined;throw error;});
  return libraryPromise;
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
  const expressions=new Graphics();body.addChildAt(expressions,body.children.length-1);
  const brows=new Graphics();body.addChildAt(brows,body.children.length-1);
  root.visible=false;
  return {root,shadow,feet,body,clothes,held,behind,parts,spec,brows,expressions,garments:[]};
}
const defaultPose=()=>({sqx:1,sqy:1,bob:0,sway:0,lean:0,breath:0,headY:0,headTilt:0,wingL:0,wingR:0,wingForward:0,footL:0,footR:0,stepL:0,stepR:0,bill:0,eye:1,angry:0,tail:0});
function samplePose(action,t,walkPhase,reduced,speed=165){
  const p=defaultPose(),s=Math.sin(t*TAU/2.8),dance=Math.sin(t*TAU/1.35),step=Math.sin(walkPhase);
  p.breath=Math.sin(t*1.8)*.012;p.sway=s*.012;p.headTilt=Math.sin(t*.85)*.014;p.tail=Math.sin(t*2)*.025;
  switch(action){
    case 1:{// boss 4 Nov: the Rive waddle: rock onto the standing foot, squash on each footfall, stretch as it passes, head and tail follow late
      const k=clamp(speed/165,.7,1.5),lift=Math.abs(step),contact=Math.pow(1-lift,4);
      p.bob=-Math.pow(lift,.8)*9*k;p.sqy=1-contact*.07*k+lift*.025;p.sqx=1+contact*.06*k-lift*.012;
      p.sway=step*.065*k;p.lean=.03*k;
      p.footL=Math.pow(Math.max(0,step),1.4)*18*k;p.footR=Math.pow(Math.max(0,-step),1.4)*18*k;p.stepL=step*9*k;p.stepR=-step*9*k;
      p.wingL=-step*.13-.04*k;p.wingR=-step*.13+.04*k;p.headY=Math.cos(walkPhase*2-.7)*3*k;p.headTilt=-step*.03;p.tail=-step*.2;break;}
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
export async function createDuck({outfit={cap:8,shades:1,acc:0,shoes:2},seed=0,isPlayer=false}={}){
  liveDucks++;
  let data;
  try{data=await library();}catch(error){liveDucks--;throw error;}
  const root=new Container({label:'Ducky'}),art=new Container({label:'Original SVG rig'});art.scale.set(SCALE);root.addChild(art);
  const feedback=createDuckFeedback(isPlayer);art.addChild(feedback.ring);
  const views=data.views.map(makeView);views.forEach(v=>art.addChild(v.root));art.addChild(feedback.bubble,feedback.sleep);
  // Pick once so breathing, camera culling and wardrobe changes never reroll the pose.
  const napPose = isPlayer ? NAP_POSES[2] : NAP_POSES[Math.floor(Math.random() * NAP_POSES.length)];
  const nap = new Container({label:napPose.name});
  const napDirection = napPose.view !== 0 && Math.abs(seed) % 2 !== 0 ? -1 : 1;
  nap.scale.x = napDirection;
  nap.visible = false;
  const napShadow = new Graphics().ellipse(0, -4, napPose.shadow, 21).fill({color:0x232323, alpha:.16});
  const napBody = new Container();
  const napArt = new Sprite(Assets.get(napPose.url));
  napArt.anchor.set(.5, 1);
  const napHat = new Container();
  const [hatX, hatY, hatAngle] = napPose.hat;
  napHat.position.set(hatX, hatY);
  napHat.rotation = hatAngle;
  napHat.scale.set(.66);
  napBody.addChild(napArt, napHat);
  nap.addChild(napShadow, napBody);
  art.addChildAt(nap, art.children.length - 2);
  const napView = data.views.find(view => view.angle === napPose.view);
  let disposed=false,elapsed=0,actionTime=0,walkPhase=Math.abs(seed)*2.399,currentAction=0,version,turnAngle=0,current=views.find(v=>v.spec.angle===0),outfitVersion=0;
  let clothing={...outfit},pose=defaultPose();const phase=Math.abs(seed)*1.618%5;
  // boss 4 Nov: landing settle when a walk stops, a small anticipation when it starts, and a squash-pinch on every turn
  let landT=9,startT=9,turnT=9,lastSpeed=0,arriveT=9;
  // boss 4 Nov: the Rive 'Arrival Drop' (66 frames at 60 fps): falls in, squashes on touchdown, one small bounce, settles
  const DROP={y:[[0,-1.23],[27,0],[37,-.026],[49,0],[66,0]],sx:[[0,.96],[25,.96],[29,1.18],[39,.98],[49,1],[66,1]],sy:[[0,1.04],[25,1.04],[29,.78],[39,1.04],[49,1],[66,1]]};
  const keyAt=(keys,f)=>{for(let i=1;i<keys.length;i++)if(f<=keys[i][0]){const [f0,a]=keys[i-1],[f1,b]=keys[i],u=(f-f0)/(f1-f0),e=u*u*(3-2*u);return a+(b-a)*e;}return keys.at(-1)[1];};
  const artHeight=art.getLocalBounds().height||900;
  function moveFx(){
    const fx={sqx:1,sqy:1,bob:0};
    if(landT<.45){const u=landT/.45,w=Math.exp(-5*u)*Math.cos(u*Math.PI*2.4),k=clamp(lastSpeed/165,.6,1.4);fx.sqy-=.11*w*k;fx.sqx+=.09*w*k;}
    if(startT<.14){const w=Math.sin(Math.PI*startT/.14);fx.sqy-=.06*w;fx.sqx+=.05*w;}
    if(turnT<.18){const w=Math.cos(Math.PI*.5*turnT/.18);fx.sqx*=1-.24*w;fx.bob-=6*w;}
    return fx;
  }
  current.root.visible=true;current.root.alpha=1;
  async function setOutfit(next){
    const request=++outfitVersion;
    const entries=Object.entries(next).map(([slot,index])=>data.wardrobe.find(e=>e.slot===(slot==='accessory'?'acc':slot)&&(e.index===Number(index)||e.id===index))).filter(Boolean).sort((a,b)=>slotOrder.indexOf(a.slot)-slotOrder.indexOf(b.slot));
    const frames=entries.flatMap(entry=>Object.values(entry.frames).flat()).filter(frame=>frame.visible);
    await Promise.all([...new Set(frames.map(frame=>frame.url))].map(loadTexture));
    if(disposed||request!==outfitVersion)return;
    clothing={...next};
    for (const child of napHat.removeChildren()) child.destroy();
    const cap = entries.find(entry => entry.slot === 'cap');
    if (cap) {
      const frame = cap.frames[String(napView.angle)][0];
      const sprite = new Sprite(Assets.get(frame.url));
      const headCenter = (napView.attachments.head[0] + napView.attachments.head[1]) / 2;
      sprite.position.set(frame.rect[0] - headCenter, frame.rect[1] - napView.attachments.headY);
      napHat.addChild(sprite);
    }
    for(const view of views){
      for(const garment of view.garments)garment.node.destroy({children:true});
      view.garments=[];
      for(const part of view.parts){
        if(part.role==='foot'||part.role==='toe')part.joint.visible=!entries.some(e=>e.slot==='shoes');
        if(part.role==='tuft')part.joint.visible=!entries.some(e=>e.slot==='cap'&&![12,13].includes(e.sourceNumber));
      }
      for(const entry of entries)for(const frame of entry.frames[String(view.spec.angle)]){
        if(!frame.visible)continue;
        const node=new Container({label:entry.id}),sprite=new Sprite(Assets.get(frame.url));
        const [x,y]=frame.anchor;
        node.position.set(x,y);sprite.position.set(frame.rect[0]-x,frame.rect[1]-y);node.addChild(sprite);
        (frame.layer==='feet'?view.feet:frame.layer==='held'?view.held:frame.layer==='behind'?view.behind:view.clothes).addChild(node);
        view.garments.push({node,frame,entry,baseX:x,baseY:y});
      }
    }
  }
  try{await setOutfit(outfit);}catch(error){root.destroy({children:true});liveDucks--;throw error;}

  function renderView(view,t){
    const p=pose,face=Math.abs(view.spec.angle)<=90,lookSide=Math.sign(Math.sin(view.spec.angle*Math.PI/180)),fx=moveFx();
    view.body.y=p.bob;view.body.rotation=p.sway+p.lean*lookSide;view.body.scale.set((1-p.breath*.32)*p.sqx*fx.sqx,(1+p.breath)*p.sqy*fx.sqy);view.body.y+=fx.bob+12;   // boss 4 Nov: belly sits over the top edge of the feet, no dark band between them
    view.shadow.scale.set(1-clamp(-p.bob,0,35)*.005,1);view.shadow.alpha=1-clamp(-p.bob,0,35)*.01;
    const blinkAt=(t+phase)%4.8,blink=blinkAt<.14?Math.max(.06,Math.abs(blinkAt-.07)/.07):1;
    for(const part of view.parts){
      const joint=part.joint,side=part.side;joint.position.set(joint.rest.x,joint.rest.y);joint.rotation=0;joint.scale.set(1);
      if(part.role==='wing'){joint.rotation=side<0?p.wingL:p.wingR;joint.y+=Math.abs(p.sway)*10;}
      if(part.role==='foot'){const lift=side<0?p.footL:p.footR,step=side<0?p.stepL:p.stepR;joint.y-=lift;joint.x+=step*.55;joint.rotation=-side*lift*.005;}
      if(part.role==='eye'){joint.visible=currentAction!==5;joint.scale.y=Math.min(p.eye,blink);joint.y+=p.headY;joint.rotation=p.headTilt;}
      if(part.role==='beak'){joint.y+=p.headY;joint.rotation=p.headTilt;joint.scale.set(1+p.bill*.08,1+p.bill*1.8);}
      if(part.role==='tuft'){joint.y+=p.headY*.42;joint.rotation=p.headTilt+p.tail*.35;}
      if(part.role==='tail')joint.rotation=p.tail;
      if(part.role==='toe')joint.visible=!clothing.shoes&&currentAction!==1;
    }
    const eyes=view.parts.filter(part=>part.role==='eye');
    for(const garment of view.garments){
      const {node,frame}=garment;
      node.position.set(garment.baseX,garment.baseY);node.rotation=0;
      if(frame.attachment==='head'||frame.attachment==='eyes'){
        node.y+=p.headY;node.rotation=p.headTilt;
      }
      if(frame.attachment==='foot'){
        const lift=frame.side<0?p.footL:p.footR,step=frame.side<0?p.stepL:p.stepR;
        node.y-=lift;node.x+=step*.55;node.rotation=-frame.side*lift*.005;
      }
      if(frame.attachment==='wing'){
        node.y+=Math.abs(p.sway)*10;node.rotation=frame.wingSide<0?p.wingL:p.wingR;
      }
      if(frame.attachment==='grip')node.visible=Math.max(Math.abs(p.wingL),Math.abs(p.wingR))<.3;
    }
    view.expressions.clear();if(currentAction===5)for(const eye of eyes){const {x,y}=eye.joint;view.expressions.moveTo(x-14,y).quadraticCurveTo(x,y-17,x+14,y).stroke({color:0x232323,width:5,cap:'round'});}
    view.brows.clear();if(p.angry>.02&&face)for(const eye of eyes){const {x,y}=eye.joint;const side=eye.side;view.brows.moveTo(x-side*17,y-20).lineTo(x+side*14,y-9).stroke({color:0x232323,width:6,alpha:p.angry,cap:'round'});}
  }
  function update(dt,{action=0,speed=0,turn=0,time,reducedMotion=false,emoteVersion,persistentSleep=false}={}){
    if(disposed)return;dt=clamp(safe(dt),0,.1);elapsed+=dt;
    const next=typeof action==='string'?Number(Object.entries(duckAnimationNames).find(([,name])=>name===action)?.[0]||0):Number(action);
    const chosen=Number.isInteger(next)&&next>=0&&next<=9?next:0;
    if(chosen!==currentAction||(emoteVersion!==undefined&&emoteVersion!==version)){if(currentAction===1&&chosen!==1)landT=0;if(chosen===1&&currentAction!==1)startT=0;currentAction=chosen;actionTime=0;version=emoteVersion;}
    landT+=dt;startT+=dt;turnT+=dt;arriveT+=dt;if(reducedMotion)landT=startT=turnT=9;if(currentAction===1)lastSpeed=safe(speed);
    actionTime+=dt;walkPhase+=dt*9.8*clamp(safe(speed)/165,.55,1.8);
    const desired=samplePose(currentAction,actionTime,walkPhase,reducedMotion,safe(speed)||165),smoothing=1-Math.exp(-dt/0.11);
    for(const key of Object.keys(pose))pose[key]+=(desired[key]-pose[key])*smoothing;
    turnAngle+=angleDifference(safe(turn),turnAngle)*(1-Math.exp(-dt/.075));
    const degrees=turnAngle*180/Math.PI,target=views.reduce((best,v)=>Math.abs(angleDifference(v.spec.angle*Math.PI/180,turnAngle))<Math.abs(angleDifference(best.spec.angle*Math.PI/180,turnAngle))?v:best,current);
    if(target!==current&&Math.abs(angleDifference(current.spec.angle*Math.PI/180,turnAngle))>Math.PI/8+.025){current.root.visible=false;current=target;if(!reducedMotion)turnT=0;}
    const t=Number.isFinite(time)?time:elapsed;
    const sleeping = currentAction === 7;
    current.root.visible = !sleeping;
    nap.visible = sleeping;
    if (sleeping) {
      // Keep the belly planted as the back rises and falls.
      napBody.scale.y = reducedMotion ? 1 : 1 + Math.sin(t * 1.5 + phase) * .025;
    } else {
      renderView(current,t);
    }
    feedback.update(currentAction,actionTime+ (persistentSleep?phase:0),reducedMotion,persistentSleep);
    if (sleeping) {
      feedback.sleep.position.set(napDirection * napPose.z[0], napPose.z[1]);
      feedback.bubble.y += 285;
    }
    if(arriveT<1.1&&!reducedMotion){const f=arriveT*60;art.y=keyAt(DROP.y,f)*artHeight*SCALE;art.scale.set(SCALE*keyAt(DROP.sx,f),SCALE*keyAt(DROP.sy,f));}
    else{art.y=0;art.scale.set(SCALE);}
    root.duckDirection=degrees;
  }
  function dispose(){if(disposed)return;disposed=true;outfitVersion++;liveDucks--;root.removeFromParent();root.destroy({children:true});}
  update(0,{action:0});
  const arrive=()=>{arriveT=0;};
  return {root,update,dispose,setOutfit,arrive,animationNames:duckAnimationNames};
}
