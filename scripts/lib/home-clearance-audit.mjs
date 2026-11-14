import {HOME_DUCK_BODY} from '../../src/world/home/duck-body.js';
import sharp from 'sharp';
import {alphaContours} from './alpha-contour.mjs';
import {geometry,inShape,shapeIndex} from '../../assets/world/island-geometry.mjs';

// Re-rasterize source artwork, independently of the generated outline catalogue.
// Unsimplified pixel-cell edges give a 256-square alpha-mask distance oracle.
export async function homeClearanceOracle(props,world){
  const rasters=new Map(),shapes=[];
  for(const p of props.filter(p=>p.outlineKind==='solid')){
    if(!rasters.has(p.src)){
      const rgba=await sharp('public'+p.src).resize(256,256,{fit:'fill'}).ensureAlpha().raw().toBuffer();
      const stride=257,sums=new Int32Array(stride*stride);
      for(let y=0;y<256;y++)for(let x=0;x<256;x++)sums[(y+1)*stride+x+1]=(rgba[(y*256+x)*4+3]>32?1:0)+sums[y*stride+x+1]+sums[(y+1)*stride+x]-sums[y*stride+x];
      rasters.set(p.src,{rings:alphaContours(rgba,256,0),sums});
    }
    const w=p.width*p.scale,h=p.height*p.scale;
    const rings=rasters.get(p.src).rings.map(r=>r.map(([u,v])=>[p.x+(p.flip?p.anchor.x-u:u-p.anchor.x)*w,p.y+(v-p.anchor.y)*h]));
    shapes.push({prop:p.id,p,poly:rings[0],parts:rings.slice(1)});
  }
  const near=shapeIndex(shapes,30), bodyNear=shapeIndex(shapes,HOME_DUCK_BODY.height);
  // Independent summed-area raster query: intersects the actual world body
  // rectangle with occupied source-pixel cells. No generated blocker geometry.
  const frontClear=(x,y,margin=0)=>!bodyNear(x,y).some(({p})=>{
    if(p.sortY<=y)return false;
    const w=p.width*p.scale,h=p.height*p.scale;
    const u=wx=>(p.anchor.x+(p.flip?-1:1)*(wx-p.x)/w)*256;
    const ux=[u(x-HOME_DUCK_BODY.width/2-margin),u(x+HOME_DUCK_BODY.width/2+margin)].sort((a,b)=>a-b);
    const a=Math.max(0,Math.floor(ux[0])),b=Math.min(256,Math.ceil(ux[1]));
    const c=Math.max(0,Math.floor((p.anchor.y+(y-HOME_DUCK_BODY.height-margin-p.y)/h)*256)),d=Math.min(256,Math.ceil((p.anchor.y+(y-p.y)/h)*256));
    if(a>=b||c>=d)return false;
    const t=rasters.get(p.src).sums,k=257;
    return t[d*k+b]-t[c*k+b]-t[d*k+a]+t[c*k+a]>0;
  });
  // Retain water, fences and residents as independent barriers. Only generated
  // prop blockers are replaced by the alpha-pixel distance oracle.
  const ground=geometry({...world,obstacles:world.obstacles.filter(o=>!o.building)}).walkable;
  const feetClear=(x,y,pad=30)=>!near(x,y).some(o=>inShape(x,y,o,pad));
  const clear=(x,y,pad=30)=>feetClear(x,y,pad)&&frontClear(x,y,Math.max(0,pad-22));
  return {shapes,clear,feetClear,frontClear,eligible:(x,y)=>ground(x,y)&&clear(x,y)};
}

export function auditHomeClearance(world,spawn,oracle,clients,step=16){
  const {x:x0,y:y0}=world.origin,cols=Math.ceil(world.width/step),rows=Math.ceil(world.height/step);
  const eligible=new Uint8Array(cols*rows),seen=new Uint8Array(cols*rows),queue=new Int32Array(cols*rows);
  const point=i=>[x0+(i%cols+.5)*step,y0+(Math.floor(i/cols)+.5)*step];
  const land=geometry({...world,obstacles:[]}).walkable;
  let landSamples=0;const blocked=clients.map(()=>0),bodyClearanceViolations=clients.map(()=>0),frontBodyOverlaps=clients.map(()=>0);
  for(let i=0;i<eligible.length;i++){
    const p=point(i);
    if(land(...p)){landSamples++;const overlaps=!oracle.clear(...p,22-1e-6);clients.forEach((c,k)=>{const walks=c(...p);if(!walks)blocked[k]++;else {if(overlaps)bodyClearanceViolations[k]++;if(!oracle.frontClear(...p))frontBodyOverlaps[k]++;}});}
    if(oracle.eligible(...p))eligible[i]=1;
  }
  let start=-1,best=Infinity;
  for(let i=0;i<eligible.length;i++)if(eligible[i]){const p=point(i),d=Math.hypot(p[0]-spawn[0],p[1]-spawn[1]);if(d<best){start=i;best=d;}}
  if(start<0||best>step*2)throw Error('Spawn has no clear oracle cell');
  let head=0,tail=1;queue[0]=start;seen[start]=1;
  const violations=clients.map(()=>0),examples=clients.map(()=>[]);
  while(head<tail){
    const i=queue[head++],p=point(i);
    clients.forEach((c,k)=>{if(!c(...p)){violations[k]++;if(examples[k].length<8)examples[k].push(p);}});
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=i%cols+dx,y=Math.floor(i/cols)+dy,j=y*cols+x;
      if(x<0||x>=cols||y<0||y>=rows||seen[j]||!eligible[j])continue;
      // Do not connect across narrow water/fence/opaque barriers between samples.
      if(![.25,.5,.75].every(t=>oracle.eligible(p[0]+dx*step*t,p[1]+dy*step*t)))continue;
      seen[j]=1;queue[tail++]=j;
    }
  }
  return {step,landSamples,landAreaUnits2:landSamples*step*step,blockedSamples:blocked,blockedPercent:blocked.map(n=>100*n/landSamples),connectedClearSamples:tail,violations,bodyClearanceViolations,frontBodyOverlaps,examples};
}

// Sweep the walker itself, rather than the oracle's open-ground component.
// Rasterize each connected sample's standing box against foreground alpha cells.
export function auditConnectedBodies(world,spawn,oracle,walkable,step=16){
  const cols=Math.ceil(world.width/step),rows=Math.ceil(world.height/step),count=cols*rows;
  const state=new Uint8Array(count),queue=new Int32Array(count);
  const point=i=>[world.origin.x+(i%cols+.5)*step,world.origin.y+(Math.floor(i/cols)+.5)*step];
  let start=-1,best=Infinity;
  for(let i=0;i<count;i++){const p=point(i);if(walkable(...p)){state[i]=1;const d=Math.hypot(p[0]-spawn[0],p[1]-spawn[1]);if(d<best){best=d;start=i;}}}
  if(start<0||best>step*2)throw Error('Spawn not on connected walk lattice');
  let head=0,tail=1,overlaps=0;const examples=[];queue[0]=start;state[start]=2;
  while(head<tail){const i=queue[head++],p=point(i);
    if(!oracle.frontClear(...p)){overlaps++;if(examples.length<8)examples.push(p);}
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=i%cols+dx,y=Math.floor(i/cols)+dy,j=y*cols+x;
      if(x<0||x>=cols||y<0||y>=rows||state[j]!==1)continue;
      if(![.25,.5,.75].every(t=>walkable(p[0]+dx*step*t,p[1]+dy*step*t)))continue;
      state[j]=2;queue[tail++]=j;
    }
  }
  return {samples:tail,overlaps,examples};
}
