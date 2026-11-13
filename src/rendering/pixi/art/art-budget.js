import {Texture, Rectangle} from 'pixi.js';
import {artResolution} from '../../shared/art-resolution.js';
import sizes from '../../shared/art-source-sizes.json' with {type:'json'};
import {tileInView} from './ground-stream.js';

export const MAX_ART_PIXELS = 4_000_000;

// Stable wrappers preserve sprite placement while off-screen sources are freed.
export function createArtBudget(entries, {acquire, release, zoom, dpr, poolBudget, views}) {
  const bucket=value=>Math.max(.0625,Math.ceil(value*8)/8);
  const sources=new Map(),screen={zoom:bucket(zoom*dpr),dpr:1};
  let disposed=false,lastCheck=-Infinity,settledAt=0,density=screen.zoom,appliedDensity=density,pendingCount=0;
  let currentViews=views,zooming=false;
  for(const entry of entries){
    let source=sources.get(entry.src);
    if(!source)sources.set(entry.src,source={entries:[],texture:null,key:null,pending:null,claim:null,size:sizes[entry.src]});
    source.entries.push(entry);
  }
  const wanted=source=>currentViews===undefined||source.entries.some(entry=>{
    if(!Number.isFinite(entry.x))return true;
    const width=(entry.width??source.size?.[0]??1)*(entry.scale??1),height=(entry.height??source.size?.[1]??1)*(entry.scale??1);
    const anchor=entry.anchor??(entry.topLeft?{x:0,y:0}:{x:.5,y:1});
    return currentViews.some(v=>tileInView({x:entry.x-width*anchor.x,y:entry.y-height*anchor.y,width,height},v.camera,v.width,v.height,v.tilt,192/v.camera.zoom));
  });
  const detach=source=>{
    if(source.texture){source.texture.source=Texture.EMPTY.source;source.texture.frame=new Rectangle(0,0,1,1);source.texture.update();}
    if(source.key)release(source.key);
    poolBudget?.release(source.claim);source.claim=null;source.key=null;
  };
  const load=async source=>{
    if(!source.size){
      // New theme assets need intrinsic dimensions too. Never fall back to a
      // fixed 2x decode just because the generated size index predates the art.
      source.sizing??=fetch(source.entries[0].src).then(r=>{if(!r.ok)throw Error('Art sizing '+r.status);return r.text();}).then(svg=>{
        const root=svg.match(/<svg\b[^>]*>/)?.[0]??'';
        const attr=name=>root.match(new RegExp('\\b'+name+'=["\\\']([^"\\\']+)'))?.[1];
        const box=attr('viewBox')?.split(/[ ,]+/).map(Number);
        return [parseFloat(attr('width'))||box?.[2]||1,parseFloat(attr('height'))||box?.[3]||1];
      });
      source.size=await source.sizing;
    }
    const [w,h]=source.size;
    if(!source.texture)source.texture=new Texture({source:Texture.EMPTY.source,orig:new Rectangle(0,0,w,h),dynamic:true});
    if(disposed||!wanted(source)||zooming)return source.texture;
    let resolution=0;
    for(const entry of source.entries)resolution=Math.max(resolution,artResolution(entry,entry.resolution??1,{[entry.src]:source.size},screen));
    // Rounding the backing dimensions up must still respect the pixel ceiling.
    resolution=Math.min(resolution,Math.sqrt(MAX_ART_PIXELS/((w+1)*(h+1))));
    const key=source.entries[0].src+(source.entries[0].src.includes('?')?'&':'?')+'artScale='+resolution;
    if(source.key===key)return source.texture;
    if(source.pending)return source.pending;
    const requestedDensity=screen.zoom;
    const claim=poolBudget?.reserve(Math.ceil(w*resolution)*Math.ceil(h*resolution)*4*4/3,{kind:'static'});
    // Release an obsolete backing before admitting its replacement.
    if(source.key){detach(source);if(poolBudget&&!claim)return load(source);}
    if(poolBudget&&!claim)return source.texture;
    if(claim)claim.evict=()=>detach(source);
    pendingCount++;
    source.pending=acquire(key,resolution).then(texture=>{
      if(disposed||!wanted(source)||requestedDensity!==screen.zoom){release(key);poolBudget?.release(claim);return source.texture;}
      if(poolBudget&&!poolBudget.commit(claim,texture.source)){release(key);poolBudget.release(claim);return source.texture;}
      source.texture.source=texture.source;source.texture.frame=texture.frame.clone();source.texture.update();
      source.key=key;source.claim=claim;return source.texture;
    },error=>{release(key);poolBudget?.release(claim);throw error;}).finally(()=>{
      source.pending=null;pendingCount--;
    }).then(texture=>!disposed&&requestedDensity!==screen.zoom?load(source):texture);
    return source.pending;
  };
  return {
    get pending(){return pendingCount;},
    acquire(entry){return load(sources.get(entry.src));},
    update(zoom,dpr,now,visible=true,nextViews,activeZoom=false){
      const resuming=zooming&&!activeZoom;zooming=activeZoom;
      if(resuming){density=bucket(zoom*dpr);settledAt=now-250;lastCheck=-Infinity;}
      if(disposed||zooming||now-lastCheck<250)return;
      lastCheck=now;
      if(nextViews!==undefined)currentViews=visible?nextViews:[];
      const next=bucket(zoom*dpr);
      if(next!==density){density=next;settledAt=now;}
      if(now-settledAt>=250&&next!==appliedDensity&&visible){appliedDensity=next;screen.zoom=next;}
      for(const source of sources.values()){
        if(!wanted(source)){detach(source);continue;}
        if(source.texture&&!source.pending)load(source).catch(()=>{});
      }
    },
    destroy(){if(disposed)return;disposed=true;for(const source of sources.values()){detach(source);source.texture?.destroy();}},
  };
}
