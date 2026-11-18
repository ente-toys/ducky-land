// The race scene: a 3/4 view looking down a diagonal slope. Further down the hill is lower on screen and a
// little to the right; the camera follows your racer and keeps it in the upper third so you see what's coming.
import {Assets,Container,Graphics,Rectangle,Sprite,Text,Texture} from 'pixi.js';
import {ART_TEXTURE} from '../../rendering/pixi/art/art-texture.js';
import {laneWidth,laneX,seededRandom} from './course.js';
import {SLED,TUBE_COLOURS} from './rules.js';
import {RIDERS,dressRider,loadWardrobe,riderFor} from './outfit.js';

const ART_DIR='/pixi-art/sled-race/',SNOW='/pixi-art/themes/snow/final/',EXT='.svg';
export const SLED_ART=Object.freeze({
  rock:`${ART_DIR}rock${EXT}`,snowman:`${ART_DIR}snowman${EXT}`,log:`${ART_DIR}log${EXT}`,fence:`${ART_DIR}fence${EXT}`,ramp:`${ART_DIR}ramp${EXT}`,ice:`${ART_DIR}ice${EXT}`,
  ...Object.fromEntries(Object.values(RIDERS).flatMap(({art})=>TUBE_COLOURS.map((c,i)=>[`${art}${i}`,`${ART_DIR}${art}-${i}.svg`]))),start:`${ART_DIR}gate-start${EXT}`,finish:`${ART_DIR}gate-finish${EXT}`,divider:`${ART_DIR}divider${EXT}`,
  crash1:`${ART_DIR}crash-1${EXT}`,crash2:`${ART_DIR}crash-2${EXT}`,crash3:`${ART_DIR}crash-3${EXT}`,spray1:`${ART_DIR}spray-1${EXT}`,spray2:`${ART_DIR}spray-2${EXT}`,
  sparkle:`${ART_DIR}sparkle${EXT}`,streaks:`${ART_DIR}streaks${EXT}`,puff:`${ART_DIR}puff${EXT}`,confetti:`${ART_DIR}confetti${EXT}`,flakes:`${ART_DIR}flakes${EXT}`,
  pine:`${SNOW}props/pine-large.svg`,drift:`${SNOW}props/drift-cluster.svg`,lantern:`${SNOW}rink/lantern-post.svg`,
});
// the racer is drawn in its own units (UNIT px = 1 course unit) and scaled with the camera
// a flat 2:1 isometric hill: downhill runs to the lower right (DOWN), across the course from lower left to upper
// right (ACROSS); upright things stand straight, things lying across the course are slanted along ACROSS
const DOWN={x:.894,y:.447},ACROSS={x:.894,y:-.447};
// the drawn art is close to 2:1 isometric but not exact; these skews (radians, measured from each sprite) true it up
const TRUE_UP={start:-.21,finish:-.21,fence:-.055,log:.037,ice:-.1,divider:.11};
// long pieces are cut into upright strips, each depth-sorted at its own spot on the ground, so a racer can be in
// front of one end of a gate and behind the other
const SLICES=12;
// the start and finish gates: the share of the drawing's width between the centres of its two posts
const GATE_POSTS=.71;
// the racer sprite (Ducky sitting in a snow tube, one file per tube colour) in its own units: UNIT px = 1 course unit
const UNIT=40,RIDER_WIDTH=2.3;
const SKY={clear:0xdfecf6,snow:0xd9e5ef,evening:0xb4c4da},TRACK={clear:0xf8fbff,snow:0xf2f7fb,evening:0xe3eaf4};

// the art turns into textures at its drawn size times this; the gates are drawn small and shown screen-wide, so
// they are rasterised much finer to stay crisp
const SHARPER={start:8,finish:8};
export async function loadSledArt(){
  await Promise.all([...Object.entries(SLED_ART).map(([key,src])=>Assets.load({src,data:{...ART_TEXTURE,resolution:SHARPER[key]??2}})),loadWardrobe()]);
}

export async function createSledView(app,{course,racers,me}){
  // hidden until the first update has placed everything
  const stage=new Container({label:'Sled race',visible:false});app.stage.addChild(stage);
  const ground=new Graphics({label:'Slope'}),flat=new Container({label:'On the snow'}),world=new Container({label:'Standing',sortableChildren:true}),air=new Container({label:'Effects'});
  stage.addChild(ground,flat,world,air);
  const tint=new Graphics({label:'Evening'});if(course.weather==='evening')stage.addChild(tint);
  const tex=key=>Assets.get(SLED_ART[key]);
  let P=40,W=app.screen.width,H=app.screen.height,camD=0,camX=course.centre(0),camAX=.3,camY=.42;
  // the camera keeps your racer up and to the left, so most of the screen shows the hill ahead; at the start it
  // frames the start gate in the top-left corner and eases over to you in the first seconds
  const sx=(d,x)=>W*camAX+((d-camD)*DOWN.x+(x-camX)*ACROSS.x)*P,sy=(d,x)=>H*camY+((d-camD)*DOWN.y+(x-camX)*ACROSS.y)*P;
  const place=(sprite,d,x)=>{const at=course.centre(d)+x;sprite.position.set(sx(d,at),sy(d,at));sprite.zIndex=sprite.y;};

  // course pieces: made once, culled each frame
  const pieces=[],stripTextures=[];
  // the art is drawn isometric already; width is the piece's screen width in course units, anchorY its ground point,
  // axis the ground line a long piece lies along ('across' or 'along' the course)
  const piece=(key,d,x,width,{layer=world,anchorY=.88,axis=null}={})=>{
    const t=tex(key),n=axis&&layer===world?SLICES:1,strips=[];
    for(let i=0;i<n;i++){
      const w=t.frame.width/n,cut=n>1?new Texture({source:t.source,frame:new Rectangle(t.frame.x+i*w,t.frame.y,w+(i<n-1?1:0),t.frame.height)}):t;
      if(n>1)stripTextures.push(cut);
      const s=new Sprite(cut);s.anchor.set(n>1?0:.5,anchorY);s.skew.y=TRUE_UP[key]??0;layer.addChild(s);
      strips.push({s,from:i*w-t.frame.width/2,mid:(i+.5)*w-t.frame.width/2});
    }
    pieces.push({strips,d,x,width,full:t.frame.width,skew:TRUE_UP[key]??0,slope:axis==='across'?ACROSS.y/ACROSS.x:axis==='along'?DOWN.y/DOWN.x:0});
  };
  // each obstacle fills its lane: art width as a share of the lane
  const GROUND={log:.68,fence:.8},LONG=new Set(['log','fence']),FILL={rock:.95,snowman:.8,log:1.15,fence:1.1};
  for(const p of course.ice)piece('ice',(p.d0+p.d1)/2,(p.x0+p.x1)/2,(p.x1-p.x0)*1.3,{layer:flat,anchorY:.5});
  for(const h of course.hazards)piece(h.kind,h.d,h.x,laneWidth()*FILL[h.kind],{anchorY:GROUND[h.kind]??.88,axis:LONG.has(h.kind)?'across':null});
  // a ramp is a snow kicker in every lane; each is small enough to sort as one piece
  for(const r of course.ramps)for(let lane=0;lane<SLED.lanes;lane++)piece('ramp',r.d,laneX(lane),laneWidth()*2,{anchorY:.5});
  for(const f of course.forks)for(let d=f.d0;d<f.d1;d+=3.2)piece('divider',d,0,3.6,{anchorY:.55,axis:'along'});
  // the gates stand outside the banks: their posts are GATE_POSTS of the drawing's width apart, so they are drawn
  // wide enough to put each post just beyond the track edge
  const gate=(course.half+1.3)*2*ACROSS.x/GATE_POSTS;
  piece('start',-1.2,0,gate,{anchorY:.82,axis:'across'});piece('finish',course.length,0,gate,{anchorY:.82,axis:'across'});
  const random=seededRandom(course.seed^0x9e3779b9);
  for(let d=-12;d<course.length+40;d+=random()*5+3)for(const side of [-1,1]){
    const out=course.half+1.2+random()*5;
    piece(random()<.55?'pine':'drift',d,side*out,random()<.55?2.6+random()*1.2:2.4);
    if(course.weather==='evening'&&random()<.18)piece('lantern',d,side*(course.half+.8),1);
  }

  // racers: Ducky in a tube of the racer's colour, with a name tag
  const riders=new Map();
  const wardrobe=await loadWardrobe();
  await Promise.all(racers.map(async(r,i)=>{
    const root=new Container({label:`Racer ${r.name}`}),shadow=new Graphics().ellipse(0,0,46,16).fill({color:0x6f8aa3,alpha:.28});
    // the drawing and the outfit share the drawing's pixels; the tube's contact point sits on the racer's spot
    const look=riderFor(r.outfit,wardrobe.entries),body=new Sprite(tex(`${look.art}${(r.colour??i)%TUBE_COLOURS.length}`));
    const rider=new Container({label:'Rider'});rider.addChild(body,await dressRider(r.outfit,look,wardrobe));
    rider.pivot.set(body.texture.width/2,body.texture.height*look.ground);rider.scale.set(RIDER_WIDTH*UNIT/body.texture.width);
    const tag=new Container(),label=new Text({text:r.bot?`${r.name}  BOT`:r.name,style:{fontFamily:'system-ui',fontSize:13,fontWeight:'700',fill:r.id===me?0x332b23:0x564537}});
    label.anchor.set(.5);const pill=new Graphics().roundRect(-label.width/2-8,-11,label.width+16,22,11).fill({color:r.id===me?0xffda69:0xfff9df}).stroke({color:0x564537,width:1});
    tag.addChild(pill,label);tag.position.set(0,-96);
    const ride=new Container();ride.addChild(rider);
    root.addChild(shadow,ride,tag);world.addChild(root);
    riders.set(r.id,{root,shadow,ride,rider,tag,spray:0});
  }));

  // short-lived effects
  const fx=[];
  function effect(frames,d,x,{life=.45,size=2.2,rise=0,layer=air}={}){
    const s=new Sprite(tex(frames[0]));s.anchor.set(.5,.6);layer.addChild(s);fx.push({s,frames,d,x,life,age:0,size,rise});
  }
  const events={
    // the burst stays on what was hit; the racer itself is moved to just below it
    crash:e=>effect(['crash1','crash2','crash3'],e.d,e.x,{life:.6,size:3}),
    boost:(e,r)=>effect(['sparkle'],r.d,r.x-course.centre(r.d),{life:.5,size:1.8,rise:1.2}),
    land:(e,r)=>effect(['puff'],r.d,r.x-course.centre(r.d),{life:.4,size:2.4,layer:flat}),
    finish:(e,r)=>effect(['confetti'],r.d,r.x-course.centre(r.d),{life:1.2,size:3,rise:2}),
  };

  // weather: a light snowfall drifting across the screen
  const flakes=course.weather==='snow'?Array.from({length:70},(_,i)=>{const s=new Sprite(tex('flakes'));s.anchor.set(.5);s.alpha=.75;air.addChild(s);return {s,x:random(),y:random(),k:.3+random()*.5,i};}):[];

  function resize(){W=app.screen.width;H=app.screen.height;P=Math.max(26,Math.min(48,H/18));}
  resize();

  function update(state,dt,{events:list=[],reduced=false}={}){
    resize();stage.visible=true;
    const mine=state.racers.find(r=>r.id===me)??state.racers[0];
    if(!mine)return;
    const start=Math.max(0,Math.min(1,1-state.time/3)),centre=course.centre(mine.d);
    camD+=(mine.d-camD)*Math.min(1,dt*10);camAX=.36-.06*start;camY=.34+(Math.max(.42,(9*P+16)/H)-.34)*start;
    camX+=((mine.x*.4+centre*.6)*(1-start)+centre*start-camX)*Math.min(1,dt*4);
    // the slope: snow everywhere, a smoother groomed track between the banks, light lines between the lanes
    const reach=(W+H)/(P*.9),from=camD-reach*.45,to=camD+reach*.8,left=[],right=[];
    for(let d=from;d<=to;d+=1){const c=course.centre(d);left.push(sx(d,c-course.half),sy(d,c-course.half));right.push(sx(d,c+course.half),sy(d,c+course.half));}
    ground.clear().rect(0,0,W,H).fill(SKY[course.weather]);
    const track=[...left];for(let i=right.length-2;i>=0;i-=2)track.push(right[i],right[i+1]);
    ground.poly(track).fill(TRACK[course.weather]);
    ground.poly(left,false).stroke({color:0xb9cddd,width:3});ground.poly(right,false).stroke({color:0xb9cddd,width:3});
    for(let k=1;k<SLED.lanes;k++){
      const pts=[];for(let d=Math.floor(from);d<=to;d+=2){const at=course.centre(d)-course.half+k*laneWidth();pts.push(sx(d,at),sy(d,at));}
      ground.poly(pts,false).stroke({color:0xe3edf5,width:2});
    }
    if(course.weather==='evening')tint.clear().rect(0,0,W,H).fill({color:0x2a3f78,alpha:.1});
    for(const p of pieces){
      const visible=p.d>from-6&&p.d<to+6;for(const {s} of p.strips)s.visible=visible;if(!visible)continue;
      const at=course.centre(p.d)+p.x,x=sx(p.d,at),y=sy(p.d,at),k=p.width*P/p.full,a=Math.cos(p.skew)*k,b=Math.sin(p.skew)*k;
      for(const {s,from:f,mid} of p.strips){
        s.scale.set(k);
        if(p.strips.length===1){s.position.set(x,y);s.zIndex=y;}
        else{s.position.set(x+a*f,y+b*f);s.zIndex=y+p.slope*a*mid;}
      }
    }
    for(const r of state.racers){
      const v=riders.get(r.id);if(!v)continue;
      const crashed=state.time<r.crashUntil,air=state.time<r.airUntil;
      const hop=air?Math.sin(Math.PI*(1-(r.airUntil-state.time)/SLED.jumpSeconds))*P*1.1:0;
      v.root.position.set(sx(r.d,r.x),sy(r.d,r.x));v.root.zIndex=v.root.y+.5;v.root.scale.set(P/UNIT);
      v.ride.y=-hop;v.tag.y=-96-hop;v.shadow.scale.set(air?.7:1);
      v.ride.rotation=crashed?Math.sin(state.time*18)*.25:r.vx*.015;
      v.rider.alpha=crashed&&Math.floor(state.time*8)%2===1?.35:1;
      // snow spray behind hard steering, streaks when tucked or boosting
      v.spray-=dt;
      if(!reduced&&!crashed&&!air&&v.spray<=0&&(Math.abs(r.vx)>4||r.tuck||state.time<r.boostUntil)){
        v.spray=.12;const rel=r.x-course.centre(r.d);
        if(Math.abs(r.vx)>4)effect(['spray1','spray2'],r.d-.6,rel,{life:.35,size:1.6,layer:flat});
        if(r.tuck||state.time<r.boostUntil)effect(['streaks'],r.d-1.2,rel,{life:.25,size:1.8});
      }
    }
    if(!reduced)for(const e of list){const r=state.racers.find(q=>q.id===e.id);if(r)events[e.type]?.(e,r);}
    for(let i=fx.length-1;i>=0;i--){
      const f=fx[i];f.age+=dt;const u=f.age/f.life;
      if(u>=1){f.s.destroy();fx.splice(i,1);continue;}
      f.s.texture=tex(f.frames[Math.min(f.frames.length-1,Math.floor(u*f.frames.length))]);
      const at=course.centre(f.d)+f.x;f.s.position.set(sx(f.d,at),sy(f.d,at)-f.rise*u*P);f.s.scale.set(f.size*P/f.s.texture.width);
      f.s.alpha=f.frames.length>1?1:1-u*u;
    }
    for(const f of flakes){
      f.y=(f.y+dt*.06*f.k)%1;const s=f.s;s.position.set(((f.x+Math.sin(state.time*.6+f.i)*.02)%1)*W,f.y*H);s.scale.set(.012*f.k*P/2);
    }
  }
  function destroy(){stage.destroy({children:true});for(const t of stripTextures)t.destroy(false);}
  return {update,destroy};
}
