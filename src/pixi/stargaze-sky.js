// The night sky a Ducky sees through a stargazing telescope: one star for everyone who starred ente/ente.
// GitHub only tells us how many stargazers there are, so most stars are anonymous. The people who have signed in to
// Ducky Land get a named star, the one from the hill's signpost. A named star's place comes from its account alone, so it
// never moves; the anonymous stars come from one seeded sequence, so a growing count only ever adds stars at the end.
// A permanent 3D universe surrounds the observer. Arrival and interaction use
// the same positions, camera and full-resolution, on-demand rendering.
import {universePosition,cameraBasis,projectStar,arrivalPose,lookAt,angleDelta,DEFAULT_FOV} from './star-universe.js';
import {astronautAt,SPACE_DUCKY_WIDTH,SPACE_DUCKY_HEIGHT} from './space-ducky.js';
import {themedConstellations} from './themed-constellations.js';
import {starConstellations} from './star-constellations.js';
const R = 2000;   // radius of the star field, in sky units
const NIGHT = '#000000', GOLD = '#e8bb6a', PALE = '#fff5de', OWNER_GREEN='#08c225';
const COLORS = ['#f4f3ee','#dfebf7','#e7d0ae','#c4cbe0'];
const WIDE = R*1.4, UNLIT = 10_000;   // the unlit stars reach past the stargazers, as far as the telescope can be turned
const CLUSTERS = [[-1150,-620],[980,-940],[1240,560],[-380,1180],[420,330]];
const BAND = -.46, BAND_COS = Math.cos(BAND), BAND_SIN = Math.sin(BAND);
// The Great Duck: the first few anonymous stars are borrowed for one constellation.
const DUCK = [[0,.2],[1.1,-.1],[1.5,-1.2],[2.6,-1.75],[3.6,-1.05],[3.55,.3],[5.2,.85],[6.8,.25],[7.7,-.85],[7.25,1.6],[5.6,2.9],[3,3.05],[1.6,2.05],[1.3,.8]];
const DUCK_AT = [-1010,330], DUCK_SIZE = 88, DUCK_EYE = [2.45,-.85];
const TAU = Math.PI * 2;

export function mulberry(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function hashAccount(account) {
  let h = 2166136261;
  for (const letter of String(account)) {h ^= letter.codePointAt(0); h = Math.imul(h, 16777619);}
  return h >>> 0;
}
// A point of the star field: on the milky band, in one of five clusters, or anywhere in the disc.
function scatter(rnd) {
  const gauss = () => {let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*v);};
  for (;;) {
    let x, y;
    const r = rnd();
    if (r < .40) {const u = (rnd()*2-1)*R*.98, v = gauss()*R*.105*(1.15-.6*Math.abs(u)/R); x = u*BAND_COS-v*BAND_SIN; y = u*BAND_SIN+v*BAND_COS;}
    else if (r < .50) {const c = CLUSTERS[rnd()*CLUSTERS.length|0]; x = c[0]+gauss()*95; y = c[1]+gauss()*95;}
    else {const a = rnd()*TAU, d = Math.sqrt(rnd())*R; x = Math.cos(a)*d; y = Math.sin(a)*d;}
    if (x*x+y*y < R*R) return [x,y];
  }
}
// Where an account's star is. The same account always gets the same place.
export function starPlace(account) {
  const [x,y] = scatter(mulberry(hashAccount(account)));
  return {x,y};
}
// The anonymous stars: positions, size, twinkle phase and colour. Star i is the same whatever the count.
export function anonymousStars(count) {
  const rnd = mulberry(20261111), n = Math.max(0, count|0);
  const x = new Float32Array(n), y = new Float32Array(n), size = new Float32Array(n), phase = new Float32Array(n), hue = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    [x[i],y[i]] = scatter(rnd);
    const m = rnd();
    size[i] = m < .80 ? .55+rnd()*.5 : m < .972 ? 1.1+rnd()*.7 : 1.9+rnd()*1.1;
    phase[i] = rnd()*TAU; hue[i] = rnd()*4|0;
  }
  const constellation = n > DUCK.length ? DUCK.length+1 : 0;   // the outline, then the eye
  for (let i = 0; i < constellation; i++) {
    const p = DUCK[i] ?? DUCK_EYE;
    x[i] = DUCK_AT[0]+p[0]*DUCK_SIZE; y[i] = DUCK_AT[1]+p[1]*DUCK_SIZE; size[i] = i < DUCK.length ? 2.5 : 1.9;
  }
  return {count:n, x, y, size, phase, hue, constellation};
}
// The stars nobody has lit yet, for the people who have not starred: spread evenly over a wider sky than the
// stargazers'. They have their own sequence, so a stargazer's star never moves to make room for them.
export function waitingStars(count = UNLIT) {
  const rnd = mulberry(20261112), n = Math.min(20_000, Math.max(0, count|0));
  const x = new Float32Array(n), y = new Float32Array(n), size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = rnd()*TAU, d = Math.sqrt(rnd())*WIDE;
    x[i] = Math.cos(a)*d; y[i] = Math.sin(a)*d; size[i] = .7+rnd()*.7;
  }
  return {count:n, x, y, size};
}
// The numbers the telescope shows: stargazers on an island right now and every other stargazer. Whoever is looking
// through the telescope is online.
export function skyCounts(data) {
  const me = data?.me?.starred ? String(data.me.accountId) : null;
  const known = new Set((data?.players ?? []).filter(player => typeof player[1] === 'string').map(player => String(player[0])));
  if (me && typeof data.me.login === 'string') known.add(me);
  const online = new Set((data?.online ?? []).map(String).filter(accountId => known.has(accountId)));
  if (me && known.has(me)) online.add(me);
  const total = Math.max(Number.isSafeInteger(data?.total) ? data.total : 0, known.size);
  return {total, online:online.size, offline:total-online.size};
}
// Turn the server's answer into what the sky draws.
export function readSky(data) {
  const me = data?.me?.starred ? String(data.me.accountId) : null;
  const online = new Set((data?.online ?? []).map(String)), friends = new Set((data?.friends ?? []).map(String));
  const seen = new Set(), named = [];
  const add = (accountId, login) => {
    accountId = String(accountId);
    if (seen.has(accountId) || typeof login !== 'string') return;
    seen.add(accountId);
    named.push({accountId, login, ...starPlace(accountId), phase:hashAccount(accountId)%628/100,
      me:accountId === me, online:accountId === me || online.has(accountId), friend:friends.has(accountId)});
  };
  for (const [accountId,login] of data?.players ?? []) add(accountId, login);
  if (me) add(me, data.me.login);
  return {...skyCounts(data), named, me:named.find(star => star.me) ?? null, friends:named.filter(star => star.friend)};
}

const escapeText=text=>String(text).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ease=t=>t*t*(3-2*t);
export function createStargazeSky({stage,lens,canvas,tag,owner,astronaut,onNews=()=>{}}){
  const ctx=canvas.getContext('2d',{alpha:false}),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width=1,height=1,dpr=1,running=false,raf=0,resizeObserver,dirty=true,loaded=false,paints=0;
  let sky=readSky(null),stars=[],lines=[],themeLines=[],me=null,focus=null,pinned=false;
  let cam={x:0,y:0,z:0,yaw:0,pitch:0,fov:DEFAULT_FOV},pose=cam,intro=null,fly=null,velocity={yaw:0,pitch:0},lastFrame=0,astronautStart=null,astronautAnchor={yaw:0,pitch:0};
  let screenX=new Float32Array(0),screenY=new Float32Array(0),screenZ=new Float32Array(0),screenSize=new Float32Array(0),previousX=new Float32Array(0),previousY=new Float32Array(0);
  let heads=new Int32Array(0),links=new Int32Array(0),columns=1,rows=1,visibleCount=0,lastPaint=0;
  const CELL=24,pointers=new Map(),cleanups=[],timings=[];
  const listen=(target,name,fn,options)=>{target.addEventListener(name,fn,options);cleanups.push(()=>target.removeEventListener(name,fn,options));};
  const sprites=COLORS.map(color=>{const image=document.createElement('canvas');image.width=image.height=64;const g=image.getContext('2d'),light=g.createRadialGradient(32,32,0,32,32,32);light.addColorStop(0,'#fff');light.addColorStop(.06,color);light.addColorStop(.18,color+'9a');light.addColorStop(.45,color+'25');light.addColorStop(1,color+'00');g.fillStyle=light;g.fillRect(0,0,64,64);return image;});
  const ownerSprite=(()=>{const image=document.createElement('canvas');image.width=image.height=64;const g=image.getContext('2d'),light=g.createRadialGradient(32,32,0,32,32,32);light.addColorStop(0,'#d9ffe6');light.addColorStop(.1,OWNER_GREEN);light.addColorStop(.4,'#08c22545');light.addColorStop(1,'#08c22500');g.fillStyle=light;g.fillRect(0,0,64,64);return image;})();
  function fit(){const box=stage.getBoundingClientRect();width=Math.max(240,Math.floor(box.width));height=Math.max(320,Math.floor(box.height));dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);columns=Math.ceil(width/CELL);rows=Math.ceil(height/CELL);heads=new Int32Array(columns*rows);dirty=true;}
  function clamp(){cam.pitch=Math.max(-Math.PI*.485,Math.min(Math.PI*.485,cam.pitch));cam.fov=Math.max(.45,Math.min(1.9,cam.fov));}
  function interrupt(){
    // Continue from the exact visible pose. No jump back to the arrival's target.
    if(intro){cam={x:pose.x,y:pose.y,z:pose.z,yaw:pose.yaw,pitch:pose.pitch,fov:pose.fov};intro=null;}
    fly=null;velocity={yaw:0,pitch:0};dirty=true;canvas.dataset.intro='complete';
  }
  function prepareIntro(){
    fly=null;velocity={yaw:0,pitch:0};lastPaint=0;previousX.fill(NaN);previousY.fill(NaN);pinned=false;tooltip(null);
    cam={x:0,y:0,z:0,yaw:0,pitch:0,fov:DEFAULT_FOV};
    if(me)cam=lookAt(me,cam);
    // Align precisely from the small head offset too.
    if(me){const b=cameraBasis(cam);cam=lookAt(me,{...cam,x:b.x,y:b.y,z:b.z});cam.x=cam.y=cam.z=0;}
    astronautAnchor={yaw:cam.yaw,pitch:cam.pitch,offsetX:(Math.random()<.5?-1:1)*(160+Math.random()*100),offsetY:(Math.random()<.5?-1:1)*(110+Math.random()*40),distance:440+Math.random()*180,phase:Math.random()*TAU};astronautStart=null;
    intro=reduced?null:{at:null,target:{...cam}};pose=intro?arrivalPose(0,cam):cam;dirty=true;
    canvas.dataset.intro=reduced?'complete':'opening';
  }
  function tooltip(star){
    focus=star;dirty=true;
    if(!star||star===me){tag.hidden=true;return;}
    const label=star.login?`@${star.login}`:`Star #${(star.index+1).toLocaleString('en')}`;
    const about=star.login?(star.online?'Online now':star.friend?'Your friend · Offline':'Offline'):'An Ente stargazer';
    tag.innerHTML=`<div><b>${escapeText(label)}</b><small>${escapeText(about)}</small></div>`;tag.hidden=false;
  }
  function placeLabels(){
    if(me&&owner){
      const p=projectStar(me,pose,width,height),ow=owner.offsetWidth||130,oh=owner.offsetHeight||50;
      let x=p.x,y=p.y;
      // Directly behind the viewer has no horizontal bearing. Keep the label
      // on an edge, rather than incorrectly pinning it to the screen centre.
      if(p.z<=2&&Math.hypot(x-width/2,y-height/2)<30)x=width-20;
      owner.style.left=Math.max(ow/2+15,Math.min(width-ow/2-15,x))+'px';owner.style.top=Math.max(80+oh,Math.min(height-26,y-20))+'px';owner.style.transform='translate(-50%,-100%)';owner.dataset.offscreen=String(!p.visible);
      canvas.dataset.ownerX=String(p.x);canvas.dataset.ownerY=String(p.y);
    }
    if(focus&&focus!==me){const p=projectStar(focus,pose,width,height);tag.hidden=!p.visible;if(p.visible){const tw=tag.offsetWidth||160,th=tag.offsetHeight||60;tag.style.left=Math.max(tw/2+12,Math.min(width-tw/2-12,p.x))+'px';tag.style.top=Math.max(80+th+16,Math.min(height-16,p.y-14))+'px';tag.style.transform='translate(-50%,-100%)';}}
  }
  function moveAstronaut(now){
    if(!astronaut||!loaded)return;
    if(astronautStart===null)astronautStart=now;
    const point=astronautAt(now-astronautStart,astronautAnchor,reduced),p=projectStar(point,pose,width,height);
    astronaut.hidden=!p.visible;
    if(!p.visible)return;
    const focal=height/(2*Math.tan(pose.fov/2)),h=Math.max(18,Math.min(86,58*focal/p.z)),scale=h/SPACE_DUCKY_HEIGHT,w=SPACE_DUCKY_WIDTH*scale;
    const label=owner&&me?{left:Number.parseFloat(owner.style.left)-(owner.offsetWidth||130)/2,top:Number.parseFloat(owner.style.top)-(owner.offsetHeight||50),right:Number.parseFloat(owner.style.left)+(owner.offsetWidth||130)/2,bottom:Number.parseFloat(owner.style.top)+22}:null;
    const collision=label&&p.x+w/2+18>label.left&&p.x-w/2-18<label.right&&p.y+h/2+18>label.top&&p.y-h/2-18<label.bottom;
    astronaut.style.width=w+'px';astronaut.style.height=h+'px';
    astronaut.style.transform=`translate3d(${p.x-w/2}px,${p.y-h/2}px,0) rotate(${point.roll}deg)`;
    astronaut.style.opacity=String(collision?0:(pose.exposure??1));
    astronaut.style.setProperty?.('--ducky-scale',String(scale));
    astronaut.dataset.depth=String(p.z);astronaut.dataset.worldPosition=JSON.stringify({x:point.x,y:point.y,z:point.z});
  }
  function draw(now){
    const started=performance.now(),basis=cameraBasis(pose),focal=height/(2*Math.tan(pose.fov/2));
    heads.fill(-1);visibleCount=0;let near=0,far=0;
    const exposure=pose.exposure??1,trail=pose.trails??0;
    // Exactly one perspective projection and one point per star. The intro,
    // drag, picking, name labels and constellation edges share this geometry.
    for(let i=0;i<stars.length;i++){
      const s=stars[i],dx=s.x-basis.x,dy=s.y-basis.y,dz=s.z-basis.z;
      const vx=basis.cy*dx-basis.sy*dz,vz0=basis.sy*dx+basis.cy*dz;
      const vy=basis.cp*dy-basis.sp*vz0,vz=basis.sp*dy+basis.cp*vz0;
      screenZ[i]=vz;
      if(vz<=2){screenX[i]=screenY[i]=NaN;continue;}
      const x=width/2+vx*focal/vz,y=height/2-vy*focal/vz;
      screenX[i]=x;screenY[i]=y;screenSize[i]=Math.max(.55,Math.min(3.5,Math.sqrt(350/vz)));
      if(x<0||x>=width||y<0||y>=height)continue;
      visibleCount++;if(s.radius<250)near++;else if(s.radius>750)far++;
      const cell=Math.floor(x/CELL)+Math.floor(y/CELL)*columns;links[i]=heads[cell];heads[cell]=i;
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=1;ctx.fillStyle=NIGHT;ctx.fillRect(0,0,width,height);
    for(let hue=0;hue<4;hue++){
      ctx.fillStyle=ctx.strokeStyle=COLORS[hue];ctx.globalAlpha=exposure*.78;ctx.lineWidth=.65;ctx.beginPath();
      for(let i=0;i<stars.length;i++){
        const s=stars[i];if(s.login||s.hue!==hue||screenZ[i]<=2)continue;
        const x=screenX[i],y=screenY[i];if(x< -24||x>width+24||y< -24||y>height+24)continue;
        const r=s.size*screenSize[i];
        if(s.size>1.6){ctx.drawImage(sprites[hue],x-r*2,y-r*2,r*4,r*4);
          // Real frame displacement, never a second wrapped star layer.
          if(trail&&lastPaint&&Number.isFinite(previousX[i])&&Math.hypot(x-previousX[i],y-previousY[i])<160){const scale=trail*Math.min(3,40/Math.max(8,now-lastPaint));ctx.moveTo(x,y);ctx.lineTo(x-(x-previousX[i])*scale,y-(y-previousY[i])*scale);}
        }else ctx.fillRect(x-r/2,y-r/2,r,r);
      }
      ctx.stroke();
    }
    ctx.lineCap='round';
    for(const [a,b]of [...lines,...themeLines]){
      const ai=a.index,bi=b.index;if(screenZ[ai]<=2||screenZ[bi]<=2)continue;
      const active=focus===a||focus===b;ctx.globalAlpha=(active ? .8 : .34)*(pose.lines??1)*exposure;ctx.strokeStyle=active?PALE:'#e7cf98';ctx.lineWidth=active?1.5:1;
      ctx.beginPath();ctx.moveTo(screenX[ai],screenY[ai]);ctx.lineTo(screenX[bi],screenY[bi]);ctx.stroke();
    }
    // Quiet warm points make the illustrated chains readable without icons.
    ctx.fillStyle='#f3dfad';ctx.globalAlpha=.75*(pose.lines??1)*exposure;
    const endpoints=new Set(themeLines.flat());
    for(const s of endpoints){const i=s.index;if(screenZ[i]<=2)continue;const x=screenX[i],y=screenY[i];if(x<0||x>width||y<0||y>height)continue;ctx.beginPath();ctx.arc(x,y,1.65,0,TAU);ctx.fill();}
    for(const s of sky.named){
      const i=s.index,x=screenX[i],y=screenY[i];if(screenZ[i]<=2||x< -30||x>width+30||y< -30||y>height+30)continue;
      const active=s===focus,r=(s.me?7:s.featured?3.5:1.7)*Math.min(1.5,screenSize[i]);
      ctx.globalAlpha=exposure*(s.online||s.me||active?1:.65);ctx.drawImage(s.me?ownerSprite:sprites[s.hue],x-r*2,y-r*2,r*4,r*4);
      ctx.fillStyle=s.me?OWNER_GREEN:'#ffffff';ctx.beginPath();ctx.arc(x,y,Math.max(.65,r*.18),0,TAU);ctx.fill();
      if(active&&!s.me){ctx.strokeStyle=GOLD;ctx.lineWidth=1;ctx.globalAlpha=.6*exposure;ctx.beginPath();ctx.arc(x,y,r+5,0,TAU);ctx.stroke();}
    }
    ctx.globalAlpha=1;placeLabels();
    previousX.set(screenX);previousY.set(screenY);lastPaint=now;
    canvas.dataset.totalStars=String(stars.length);canvas.dataset.backgroundStars=String(stars.length-sky.named.length);canvas.dataset.namedStars=String(sky.named.length);canvas.dataset.visibleStars=String(visibleCount);canvas.dataset.nearStars=String(near);canvas.dataset.farStars=String(far);canvas.dataset.resolution=String(dpr);
    canvas.dataset.spaceMode='surround-3d';canvas.dataset.view='inside';canvas.dataset.camera=JSON.stringify({x:pose.x,y:pose.y,z:pose.z,yaw:pose.yaw,pitch:pose.pitch,fov:pose.fov});
    canvas.dataset.namedTargets=JSON.stringify(sky.named.filter(s=>s.featured&&screenZ[s.index]>2&&screenX[s.index]>=0&&screenX[s.index]<width&&screenY[s.index]>=0&&screenY[s.index]<height).map(s=>({login:s.login,x:screenX[s.index],y:screenY[s.index]})));
    canvas.dataset.hoveredStar=focus?.login??'';canvas.dataset.paintCount=String(++paints);canvas.dataset.paintMode=intro?'arrival':fly||Math.hypot(velocity.yaw,velocity.pitch)>.00001?'camera':'on-demand';
    canvas.dataset.intro=intro?(pose.progress<.1?'opening':pose.progress<.76?'flight':'resolve'):'complete';canvas.dataset.introProgress=String(pose.progress??1);canvas.dataset.introStars=String(stars.length);canvas.dataset.constellationEdges=String(lines.length+themeLines.length);
    timings.push(performance.now()-started);if(timings.length>120)timings.shift();canvas.dataset.drawMs=JSON.stringify({mean:timings.reduce((a,b)=>a+b,0)/timings.length,p95:[...timings].sort((a,b)=>a-b)[Math.floor(timings.length*.95)]});dirty=false;
  }
  function frame(now){
    if(!running)return;
    const dt=Math.min(40,lastFrame?now-lastFrame:16.7);lastFrame=now;
    if(intro){if(intro.at===null)intro.at=now;pose=arrivalPose(now-intro.at,intro.target);dirty=true;if(pose.done){cam={...intro.target};pose=cam;intro=null;}}
    else{
      if(fly){const t=Math.min(1,(now-fly.at)/650),e=ease(t);cam={...fly.to,yaw:fly.from.yaw+angleDelta(fly.from.yaw,fly.to.yaw)*e,pitch:fly.from.pitch+(fly.to.pitch-fly.from.pitch)*e,fov:fly.from.fov+(fly.to.fov-fly.from.fov)*e};dirty=true;if(t===1)fly=null;}
      if(!pointers.size&&Math.hypot(velocity.yaw,velocity.pitch)>.00001){cam.yaw+=velocity.yaw*dt;cam.pitch+=velocity.pitch*dt;const decay=Math.exp(-dt/100);velocity.yaw*=decay;velocity.pitch*=decay;clamp();dirty=true;}
      pose=cam;
    }
    if(dirty)draw(now);moveAstronaut(now);raf=requestAnimationFrame(frame);
  }
  function pick(x,y){
    if(!loaded)return null;
    let selected=null,distance=12;
    const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL);
    for(let gy=Math.max(0,cy-1);gy<=Math.min(rows-1,cy+1);gy++)for(let gx=Math.max(0,cx-1);gx<=Math.min(columns-1,cx+1);gx++)for(let i=heads[gx+gy*columns];i>=0;i=links[i]){
      const s=stars[i],d=Math.hypot(screenX[i]-x,screenY[i]-y),score=d-(s.login?4:0);if(score<distance){selected=s;distance=score;}
    }
    return selected;
  }
  function turn(dx,dy,ms=16.7){
    const scale=cam.fov/height;cam.yaw-=dx*scale;cam.pitch+=dy*scale;clamp();pose=cam;dirty=true;
    velocity=reduced?{yaw:0,pitch:0}:{yaw:-dx*scale/Math.max(8,ms)*.35,pitch:dy*scale/Math.max(8,ms)*.35};
  }
  function zoom(factor){interrupt();cam.fov/=factor;clamp();pose=cam;}
  function flyTo(target){interrupt();pinned=false;tooltip(null);if(reduced){cam=target;pose=cam;dirty=true;}else fly={from:{...cam},to:target,at:performance.now()};}
  function findMe(){if(!me)return;const b=cameraBasis(cam),target=lookAt(me,{...cam,x:b.x,y:b.y,z:b.z});target.x=cam.x;target.y=cam.y;target.z=cam.z;flyTo(target);}
  function whole(){flyTo({...cam,x:0,y:0,z:0,fov:DEFAULT_FOV});}
  const local=e=>{const r=lens.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top,at:performance.now()};};
  let moved=0,gestureTap=false;
  listen(lens,'pointerdown',e=>{if(e.target!==canvas)return;interrupt();canvas.focus?.({preventScroll:true});lens.setPointerCapture(e.pointerId);pointers.set(e.pointerId,local(e));moved=0;gestureTap=pointers.size===1;});
  listen(lens,'pointermove',e=>{
    const p=local(e),previous=pointers.get(e.pointerId);
    if(!previous){if(!intro&&!pinned&&e.pointerType==='mouse'){const hit=e.target===canvas?pick(p.x,p.y):null;if(hit!==focus)tooltip(hit);}return;}
    const old=[...pointers.values()];pointers.set(e.pointerId,p);
    if(pointers.size===1){const dx=p.x-previous.x,dy=p.y-previous.y;turn(dx,dy,p.at-previous.at);moved+=Math.hypot(dx,dy);if(moved>5){tooltip(null);lens.classList.add('dragging');}}
    else if(pointers.size===2){const next=[...pointers.values()],before=Math.hypot(old[0].x-old[1].x,old[0].y-old[1].y),after=Math.hypot(next[0].x-next[1].x,next[0].y-next[1].y);if(before>0){cam.fov*=before/Math.max(1,after);clamp();dirty=true;}gestureTap=false;velocity={yaw:0,pitch:0};}
  });
  const release=e=>{if(!pointers.has(e.pointerId))return;const p=local(e);pointers.delete(e.pointerId);lens.classList.remove('dragging');if(e.type==='pointerup'&&gestureTap&&moved<5){const hit=pick(p.x,p.y);pinned=e.pointerType!=='mouse'&&Boolean(hit);tooltip(hit);}if(e.type==='pointercancel')velocity={yaw:0,pitch:0};if(!pointers.size)gestureTap=false;};
  listen(lens,'pointerup',release);listen(lens,'pointercancel',release);listen(lens,'pointerleave',()=>{if(!pinned&&!pointers.size)tooltip(null);});
  listen(lens,'wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.0012));},{passive:false});
  listen(canvas,'keydown',e=>{
    if(e.key.toLowerCase()==='r'){e.preventDefault();prepareIntro();return;}
    if(!['+','=','-','0','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();interrupt();if(e.key==='Home')findMe();else if(e.key==='0')whole();else if(['+','=','-'].includes(e.key))zoom(e.key==='-'?1/1.2:1.2);else turn(e.key==='ArrowLeft'?80:e.key==='ArrowRight'?-80:0,e.key==='ArrowUp'?-60:e.key==='ArrowDown'?60:0);velocity={yaw:0,pitch:0};
  });
  listen(canvas,'dblclick',whole);
  return {
    start(){if(running)return;running=true;fit();resizeObserver=new ResizeObserver(fit);resizeObserver.observe(stage);raf=requestAnimationFrame(frame);},
    setData(data){
      const previousTotal=loaded?sky.total:null,focusedId=focus?.accountId;
      sky=readSky(data);const named=sky.named.map((s,i)=>({...s,...universePosition(hashAccount('person:'+s.accountId)),featured:i<60||s.me||s.friend,index:i}));
      sky={...sky,named};me=named.find(s=>s.me)??null;sky.me=me;sky.friends=named.filter(s=>s.friend);
      stars=[...named];for(let i=named.length;i<sky.total;i++)stars.push({...universePosition(hashAccount('anonymous:'+i)),index:i});
      const total=stars.length;screenX=new Float32Array(total);screenY=new Float32Array(total);screenZ=new Float32Array(total);screenSize=new Float32Array(total);previousX=new Float32Array(total);previousY=new Float32Array(total);previousX.fill(NaN);previousY.fill(NaN);links=new Int32Array(total);lastPaint=0;
      // Reuse the small-chain builder in angular space. Edges connect nearby
      // directions only, with a 3D chord drawn at the actual endpoint depths.
      const candidates=named.filter(s=>s.featured).map(s=>({...s,x:s.longitude*1800,y:s.latitude*1800}));
      lines=starConstellations(candidates).map(([a,b])=>[stars[a.index],stars[b.index]]).filter(([a,b])=>(a.x*b.x+a.y*b.y+a.z*b.z)/(a.radius*b.radius)>.92);
      const heading=me?{yaw:Math.atan2(me.x,me.z),pitch:Math.atan2(me.y,Math.hypot(me.x,me.z))}:{yaw:0,pitch:0};
      const themed=themedConstellations(stars,heading);themeLines=themed.lines;canvas.dataset.themedConstellations=themed.groups.map(g=>g.name).join(',');
      focus=focusedId?named.find(s=>s.accountId===focusedId)??null:null;if(focus)tooltip(focus);else tag.hidden=true;
      if(!loaded){loaded=true;prepareIntro();}else if(previousTotal!==null&&sky.total>previousTotal)onNews(`Someone just starred Ente. ${sky.total.toLocaleString('en')} stars in our sky.`);
      dirty=true;
    },
    findMe,whole,zoom,replayIntro:prepareIntro,constellation:findMe,
    dispose(){running=false;cancelAnimationFrame(raf);resizeObserver?.disconnect();for(const fn of cleanups)fn();pointers.clear();stars=[];lines=[];themeLines=[];intro=fly=null;tag.hidden=true;if(astronaut)astronaut.hidden=true;}
  };
}
