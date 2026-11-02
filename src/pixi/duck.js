import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';

export const duckAnimationNames=Object.freeze({0:'idle',1:'walk',2:'quack',3:'dance',4:'heart',5:'laugh',6:'wave',7:'sleep',8:'grumpy',9:'party'});
const MANIFEST='/pixi-duck/manifest.json', SCALE=1/3, TAU=Math.PI*2;
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
    await Promise.all(data.views.flatMap(v=>v.parts.map(p=>loadTexture(p.url))));
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
  const root=new Container({label:`Direction ${spec.angle}`}),shadow=new Container(),feet=new Container(),body=new Container(),clothes=new Container(),parts=[];
  root.addChild(shadow,feet,body);body.addChild(clothes);
  for(const part of spec.parts){
    const created=makeJoint(Assets.get(part.url),part.rect,part.pivot,spec.ground,part.id);
    const item={...part,...created};parts.push(item);
    if(part.role==='shadow'){created.sprite.alpha=.22;shadow.addChild(created.joint);}
    else if(part.role==='foot'||part.role==='toe')feet.addChild(created.joint);
    else body.addChildAt(created.joint,body.children.length-1);
  }
  const brows=new Graphics();body.addChild(brows);
  root.visible=false;
  return {root,shadow,feet,body,clothes,parts,spec,brows,garments:[]};
}
const defaultPose=()=>({bob:0,sway:0,lean:0,breath:0,headY:0,headTilt:0,wingL:0,wingR:0,wingForward:0,footL:0,footR:0,stepL:0,stepR:0,bill:0,eye:1,heart:0,sleep:0,angry:0,tail:0});
function samplePose(action,t,walkPhase,reduced){
  const p=defaultPose(),s=Math.sin(t*TAU/2.8),dance=Math.sin(t*TAU/1.35),step=Math.sin(walkPhase);
  p.breath=Math.sin(t*1.8)*.012;p.sway=s*.012;p.headTilt=Math.sin(t*.85)*.014;p.tail=Math.sin(t*2)*.025;
  switch(action){
    case 1:p.bob=-Math.abs(step)*7;p.sway=step*.035;p.footL=Math.max(0,step)*16;p.footR=Math.max(0,-step)*16;p.stepL=step*8;p.stepR=-step*8;p.wingL=-step*.09;p.wingR=-step*.09;p.headY=Math.cos(walkPhase*2)*2;break;
    case 2:{const q=Math.max(0,Math.sin(t*TAU/1.1));p.bill=q*.85;p.headY=-q*9;p.bob=3*(1-q);p.wingL=q*.09;p.wingR=-q*.09;break;}
    case 3:p.sway=dance*.13;p.bob=-Math.abs(dance)*12;p.headTilt=-dance*.10;p.wingL=.35+Math.cos(t*5)*.30;p.wingR=-.35+Math.cos(t*5)*.30;p.footL=Math.max(0,-dance)*11;p.footR=Math.max(0,dance)*11;p.tail=dance*.12;break;
    case 4:p.headTilt=.08;p.wingL=.56;p.wingR=-.56;p.wingForward=.12;p.heart=1;p.bob=-3*(1+Math.sin(t*3));break;
    case 5:p.bob=-Math.abs(Math.sin(t*15))*6;p.headY=-4;p.headTilt=Math.sin(t*8)*.04;p.bill=.35+Math.abs(Math.sin(t*13))*.45;p.eye=.38;p.wingL=.17;p.wingR=-.17;break;
    case 6:p.wingR=-1.75+Math.sin(t*11)*.26;p.headTilt=-.055;p.sway=.03;break;
    case 7:p.bob=7;p.breath=Math.sin(t*1.2)*.018;p.headY=8;p.headTilt=.055;p.eye=.09;p.sleep=1;break;
    case 8:p.headY=5;p.headTilt=Math.sin(t*2.8)*.035;p.wingL=.28;p.wingR=-.28;p.angry=1;p.footR=Math.max(0,Math.sin(t*9))*7;break;
    case 9:p.bob=-Math.max(0,Math.sin(t*7))*25;p.sway=Math.cos(t*7)*.08;p.wingL=1.45+Math.sin(t*7)*.25;p.wingR=-1.45-Math.sin(t*7)*.25;p.footL=p.footR=Math.max(0,Math.sin(t*7))*10;p.bill=.3;p.headTilt=Math.sin(t*3)*.1;break;
  }
  if(reduced){for(const k of ['bob','sway','lean','breath','headY','headTilt','wingL','wingR','wingForward','footL','footR','stepL','stepR','tail'])p[k]*=.12;p.bill*=.45;}
  return p;
}

/**
 * Original SVG artwork, articulated at source pivots. Root anchor is ground level.
 * `turn` is radians: 0 faces down/front, +PI/2 right, PI back, -PI/2 left.
 * `speed` is world units/second. World position/scale/rotation belong to the caller.
 */
export async function createDuck({outfit={cap:8,shades:1,acc:0,shoes:2},seed=0}={}){
  liveDucks++;
  let data;
  try{data=await library();}catch(error){liveDucks--;throw error;}
  const root=new Container({label:'Ducky'}),art=new Container({label:'Original SVG rig'});art.scale.set(SCALE);root.addChild(art);
  const views=data.views.map(makeView);views.forEach(v=>art.addChild(v.root));
  const hearts=new Container({label:'Heart expression'});art.addChild(hearts);
  for(const [i,x]of [-40,36].entries()){
    const heart=new Graphics().moveTo(0,11).bezierCurveTo(-32,-7,-20,-29,0,-12).bezierCurveTo(20,-29,32,-7,0,11).fill(0xff679b).stroke({width:3,color:0x232323});heart.x=x;heart.y=-310-i*35;hearts.addChild(heart);
  }
  const sleepText=new Text({text:'z Z',style:{fontFamily:'sans-serif',fontSize:44,fontWeight:'bold',fill:0x586b76,stroke:{color:0xfff8e4,width:4}}});sleepText.position.set(85,-480);art.addChild(sleepText);
  let disposed=false,elapsed=0,actionTime=0,walkPhase=Math.abs(seed)*2.399,currentAction=0,version,turnAngle=0,current=views.find(v=>v.spec.angle===0),previous=null,blend=1,outfitVersion=0;
  let clothing={...outfit},pose=defaultPose();const phase=Math.abs(seed)*1.618%5;
  current.root.visible=true;current.root.alpha=1;
  const front=data.views.find(v=>v.angle===0),frontFeet=front.parts.filter(p=>p.role==='foot');
  async function setOutfit(next){
    const request=++outfitVersion;const entries=Object.entries(next).map(([slot,index])=>data.wardrobe.find(e=>e.slot===(slot==='accessory'?'acc':slot)&&(e.index===Number(index)||e.id===index))).filter(Boolean);
    await Promise.all(entries.flatMap(e=>e.parts.map(p=>loadTexture(p.url))));
    if(disposed||request!==outfitVersion)return;
    clothing={...next};
    for(const view of views){
      for(const child of view.clothes.removeChildren())child.destroy({children:true});
      for(const garment of view.garments.filter(g=>g.slot==='shoes'))garment.node.destroy({children:true});
      view.garments=[];
      for(const part of view.parts.filter(p=>p.role==='foot'||p.role==='toe'))part.joint.visible=!entries.some(e=>e.slot==='shoes');
      for(const entry of entries)for(const part of entry.parts){
        const node=new Container({label:entry.id});const slot=entry.slot;
        const pivot=slot==='cap'?[360,310]:slot==='shades'?[360,400]:slot==='acc'?[357,500]:[part.side<0?283:426,742];
        node.position.set((pivot[0]-360)/.88,(pivot[1]-776)/.88-10.5);
        const sprite=new Sprite(Assets.get(part.url));sprite.position.set((part.rect[0]-pivot[0])/.88,(part.rect[1]-pivot[1])/.88);sprite.scale.set(1/.88);node.addChild(sprite);
        const garment={node,slot,entry,side:part.side||0,baseX:node.x,baseY:node.y};
        if(slot==='shoes'){
          const foot=view.parts.find(p=>p.role==='foot'&&p.side===part.side),baseline=frontFeet.find(p=>p.side===part.side);
          if(!foot||!baseline){node.visible=false;view.feet.addChild(node);}else{const dx=(foot.pivot[0]-view.spec.ground[0])-(baseline.pivot[0]-front.ground[0]);node.x+=dx;garment.baseX=node.x;view.feet.addChild(node);garment.foot=foot;}
        }else view.clothes.addChild(node);
        view.garments.push(garment);
      }
    }
  }
  try{await setOutfit(outfit);}catch(error){root.destroy({children:true});liveDucks--;throw error;}

  function renderView(view,t){
    const p=pose,angle=view.spec.angle*Math.PI/180,face=Math.abs(view.spec.angle)<=90;
    view.body.y=p.bob;view.body.rotation=p.sway;view.body.scale.set(1-p.breath*.32,1+p.breath);
    view.shadow.scale.set(1-clamp(-p.bob,0,35)*.005,1);view.shadow.alpha=1-clamp(-p.bob,0,35)*.01;
    const blinkAt=(t+phase)%4.8,blink=blinkAt<.14?Math.max(.06,Math.abs(blinkAt-.07)/.07):1;
    for(const part of view.parts){
      const joint=part.joint,side=part.side;joint.position.set(joint.rest.x,joint.rest.y);joint.rotation=0;joint.scale.set(1);
      if(part.role==='wing'){joint.rotation=side<0?p.wingL:p.wingR;joint.y+=Math.abs(p.sway)*10;}
      if(part.role==='foot'){const lift=side<0?p.footL:p.footR,step=side<0?p.stepL:p.stepR;joint.y-=lift;joint.x+=step*.55;joint.rotation=-side*lift*.005;}
      if(part.role==='eye'){joint.scale.y=Math.min(p.eye,blink);joint.y+=p.headY;joint.rotation=p.headTilt;}
      if(part.role==='beak'){joint.y+=p.headY;joint.rotation=p.headTilt;joint.scale.set(1+p.bill*.08,1+p.bill*1.8);}
      if(part.role==='tuft'){joint.y+=p.headY*.42;joint.rotation=p.headTilt+p.tail*.35;}
      if(part.role==='tail')joint.rotation=p.tail;
      if(part.role==='toe')joint.visible=!clothing.shoes&&currentAction!==1;
    }
    const eyes=view.parts.filter(p=>p.role==='eye'),eyeX=eyes.length?eyes.reduce((sum,e)=>sum+e.joint.rest.x,0)/eyes.length:0;
    for(const garment of view.garments){
      const {node,slot,side}=garment;node.position.set(garment.baseX,garment.baseY);node.rotation=0;node.scale.set(1);node.alpha=1;
      if(slot==='cap'){node.x+=Math.sin(angle)*36;node.y+=p.headY*.42;node.scale.x=.70+.30*Math.abs(Math.cos(angle));node.rotation=p.headTilt;}
      if(slot==='shades'){node.x+=eyeX;node.y+=p.headY;node.scale.x=Math.max(.19,Math.abs(Math.cos(angle)));node.alpha=face?1:0;node.rotation=p.headTilt;}
      if(slot==='acc'){node.x+=Math.sin(angle)*62;node.scale.x=Math.max(.30,Math.abs(Math.cos(angle)));node.alpha=face||garment.entry.sourceNumber===12?1:0;}
      if(slot==='shoes'){const lift=side<0?p.footL:p.footR,step=side<0?p.stepL:p.stepR;node.y-=lift;node.x+=step*.55;node.rotation=-side*lift*.005;node.scale.x=.55+.45*Math.abs(Math.cos(angle));}
    }
    view.brows.clear();if(p.angry>.02&&face)for(const eye of eyes){const {x,y}=eye.joint;const side=eye.side;view.brows.moveTo(x-side*17,y-20+p.headY).lineTo(x+side*14,y-9+p.headY).stroke({color:0x232323,width:6,alpha:p.angry,cap:'round'});}
  }
  function update(dt,{action=0,speed=0,turn=0,time,reducedMotion=false,emoteVersion}={}){
    if(disposed)return;dt=clamp(safe(dt),0,.1);elapsed+=dt;
    const next=typeof action==='string'?Number(Object.entries(duckAnimationNames).find(([,name])=>name===action)?.[0]||0):Number(action);
    const chosen=Number.isInteger(next)&&next>=0&&next<=9?next:0;
    if(chosen!==currentAction||(emoteVersion!==undefined&&emoteVersion!==version)){currentAction=chosen;actionTime=0;version=emoteVersion;}
    actionTime+=dt;walkPhase+=dt*9.8*clamp(safe(speed)/165,.55,1.8);
    const desired=samplePose(currentAction,actionTime,walkPhase,reducedMotion),smoothing=1-Math.exp(-dt/0.11);
    for(const key of Object.keys(pose))pose[key]+=(desired[key]-pose[key])*smoothing;
    turnAngle+=angleDifference(safe(turn),turnAngle)*(1-Math.exp(-dt/.075));
    const degrees=turnAngle*180/Math.PI,target=views.reduce((best,v)=>Math.abs(angleDifference(v.spec.angle*Math.PI/180,turnAngle))<Math.abs(angleDifference(best.spec.angle*Math.PI/180,turnAngle))?v:best,current);
    if(target!==current&&Math.abs(angleDifference(current.spec.angle*Math.PI/180,turnAngle))>Math.PI/8+.025){if(previous)previous.root.visible=false;previous=current;current=target;current.root.visible=true;blend=0;}
    blend=Math.min(1,blend+dt/(reducedMotion?.05:.12));current.root.alpha=blend;
    const t=Number.isFinite(time)?time:elapsed;
    renderView(current,t);if(previous){previous.root.alpha=1-blend;renderView(previous,t);if(blend===1){previous.root.visible=false;previous=null;}}
    hearts.alpha=pose.heart;hearts.visible=pose.heart>.01;hearts.y=reducedMotion?0:Math.sin(t*3)*7;hearts.scale.set(1+(reducedMotion?0:Math.sin(t*4)*.06));
    sleepText.alpha=pose.sleep;sleepText.visible=pose.sleep>.01;sleepText.y=-480+(reducedMotion?0:Math.sin(t*1.5)*10);
    root.duckDirection=degrees;
  }
  function dispose(){if(disposed)return;disposed=true;outfitVersion++;liveDucks--;root.removeFromParent();root.destroy({children:true});}
  update(0,{action:0});
  return {root,update,dispose,setOutfit,animationNames:duckAnimationNames};
}
