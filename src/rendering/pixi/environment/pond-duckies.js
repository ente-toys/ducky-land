import {acquireArt, artPlaceholder} from '../art/art-recovery.js';
import {Container, Graphics, Sprite} from 'pixi.js';
import data from './pond-regions.json' with {type:'json'};
import {samplePondDucky} from './pond-motion.js';
export {samplePondDucky};
export const PONDS=data.ponds;

const WATER=0xb3e9f0, WAKE_LIFE=2, WAKE_INTERVAL=.4;

function ripplePool(parent,count,radius,label){
 return Array.from({length:count},()=>{
  const graphic=new Graphics({label}).ellipse(0,0,radius,radius*.32)
   .stroke({color:WATER,width:1.3});
  graphic.visible=false;parent.addChild(graphic);
  return {graphic,active:false,born:0,life:0,x:0,y:0,vx:0,vy:0,alpha:0};
 });
}
function emit(r,x,y,born,life,alpha,vx=0,vy=0){
 r.active=true;r.x=x;r.y=y;r.born=born;r.life=life;r.alpha=alpha;r.vx=vx;r.vy=vy;
}
function animate(pool,seconds){
 for(let i=0;i<pool.length;i++){
  const r=pool[i],g=r.graphic;
  if(!r.active){g.visible=false;continue;}
  const u=Math.max(0,(seconds-r.born)/r.life);
  if(u>=1){r.active=false;g.visible=false;continue;}
  const growth=1-(1-u)**2.4,arrival=Math.min(1,u/.12);
  g.visible=true;g.position.set(r.x+r.vx*u,r.y+r.vy*u);
  g.scale.set(1+growth*.85);g.alpha=r.alpha*arrival*(1-u);
 }
}
function resetRipples(e){
 for(let i=0;i<e.idle.length;i++)e.idle[i].active=e.idle[i].graphic.visible=false;
 for(let i=0;i<e.trail.length;i++)e.trail[i].active=e.trail[i].graphic.visible=false;
 e.idleCursor=e.trailCursor=0;
}

export async function loadPondDuckies(mapId,{tilt=1,acquire,release}={}){
 const ponds=PONDS.filter(p=>p.island===mapId),names=[...new Set(ponds.flatMap(p=>p.duckies.map(d=>d.name)))];
 const root=new Container({label:`Pond Duckies ${mapId}`});root.visible=false;
 const water=new Container({label:'Pond Ducky water'}),bodies=new Container({label:'Pond Ducky bodies'});
 root.addChild(water,bodies);
 const sources=names.map(n=>`/pixi-duck/float/parts/${n}-duck.svg`);
 const heights={f4_ring:865,g1_donut:779,g4_paperboat:677,g6_lounger:869,g3_snorkel_c:544,g2_padhat:441,f6_peek:400};
 const results=await Promise.allSettled(sources.map((src,i)=>{
  const name=names[i],height=data.assets.find(d=>d.name===name).height;
  return acquireArt(acquire,release,src,Math.min(1,height*3.6/heights[name]));
 }));
 for(const result of results)if(result.status==='rejected'){console.warn('Pond Ducky: accepting placeholder',result.reason);result.value=artPlaceholder();}
 const assets=new Map(names.map((n,i)=>[n,results[i].value])),entries=[];
 let destroyed=false;
 for(const pond of ponds)for(let index=0;index<pond.duckies.length;index++){
  const d=pond.duckies[index],scale=1;
  const duck=new Container({label:d.name}),body=new Sprite(assets.get(d.name));
  body.anchor.set(.5,.92);body.width=d.width;
  body.height=d.height/tilt;body.alpha=1;body.tint=0xffffff;
  const bodyRoot=new Container();bodyRoot.addChild(body);bodyRoot.scale.set(scale);
  duck.addChild(bodyRoot);bodies.addChild(duck);
  const idle=ripplePool(water,3,d.width*.38,'Pond rest ripple');
  const trail=ripplePool(water,12,d.width*.12,'Pond wake ripple');
  const phase=(pond.motion.seeds[index]>>>0)/4294967296*Math.PI*2;
  const pose=samplePondDucky(pond,index,Date.now()/1000,false,{x:0,y:0,dx:0,dy:0,moving:false});duck.position.set(pose.x,pose.y);
  entries.push({pond,index,duck,body:bodyRoot,idle,trail,scale,phase,pose,flip:1,
   interval:1.2+phase/(Math.PI*2)*.8,last:null,reduced:false,nextIdle:0,nextWake:0,
   idleCursor:0,trailCursor:0,emitX:pose.x,emitY:pose.y});
 }
 return {root,water,bodies,entries,
  update(seconds,reduced,visible,active=true){
   if(destroyed||!active||!root.visible)return;
   for(let i=0;i<entries.length;i++){
    const e=entries[i],p=samplePondDucky(e.pond,e.index,seconds,reduced,e.pose);
    e.duck.visible=visible(p.x,p.y,160);
    if(!e.duck.visible){
     if(e.last!==null)resetRipples(e);
     e.last=null;continue;
    }
    e.duck.position.set(p.x,p.y);
    if(p.moving&&Math.abs(p.dx)>.1)e.flip=p.dx>0?-1:1;
    e.body.scale.x=e.scale*e.flip;
    e.body.y=reduced?0:Math.sin(seconds*(1.6+e.phase*.07)+e.phase)*2.2;
    if(e.last===null||seconds-e.last>.25||seconds<e.last||e.reduced!==reduced){
     resetRipples(e);e.nextIdle=seconds;e.nextWake=seconds;e.emitX=p.x;e.emitY=p.y;
     if(!reduced&&!p.moving){
      emit(e.idle[0],p.x,p.y+3,seconds-e.interval,e.interval*2.6,.24);
      e.idleCursor=1;
     }
    }
    e.last=seconds;e.reduced=reduced;
    if(reduced){
     const g=e.idle[0].graphic;
     g.visible=true;g.position.set(p.x,p.y+3);g.scale.set(1);g.alpha=.12;
     continue;
    }
    if(!p.moving&&seconds>=e.nextIdle){
     emit(e.idle[e.idleCursor],p.x,p.y+3,seconds,e.interval*2.6,.24);
     e.idleCursor=(e.idleCursor+1)%e.idle.length;e.nextIdle=seconds+e.interval;
    }
    if(p.moving&&seconds>=e.nextWake&&Math.hypot(p.x-e.emitX,p.y-e.emitY)>=2){
     const len=Math.hypot(p.dx,p.dy)||1,dx=p.dx/len,dy=p.dy/len;
     const width=e.pond.duckies[e.index].width,stern=width*.28,spread=width*.09;
     for(let side=-1;side<=1;side+=2){
      emit(e.trail[e.trailCursor],p.x-dx*stern-dy*spread*side,p.y+3-dy*stern+dx*spread*side,
       seconds,WAKE_LIFE,.22,-dy*width*.22*side,dx*width*.22*side);
      e.trailCursor=(e.trailCursor+1)%e.trail.length;
     }
     e.emitX=p.x;e.emitY=p.y;e.nextWake=seconds+WAKE_INTERVAL;
    }
    animate(e.idle,seconds);animate(e.trail,seconds);
   }
  },
  destroy(){if(destroyed)return;destroyed=true;root.destroy({children:true,context:true});sources.forEach(release);entries.length=0;},
 };
}
