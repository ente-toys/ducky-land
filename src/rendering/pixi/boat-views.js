import {buildBoatAtlas} from './boat-atlas.js';
import {uploadIsland} from './art/island-preparation.js';
import {Assets, Rectangle, Texture} from 'pixi.js';

const DIR = '/pixi-art/boat/';
const SECTOR = {s: 0, se: 45, e: 90, ne: 135, n: 180, nw: -135, w: -90, sw: -45};
const RAD = Math.PI / 180;
const HYST = 3 * RAD;
export const LEGACY_SEAT = {x: 45, y: -48};
const SHARP = 1.25;   // the authored boat drawing scale (views.json resolution)
const art = (src, resolution = SHARP) => ({src, data: {resolution, autoGenerateMipmaps: true}});
// The 48-direction atlas is drawn small to stay in budget, so it reads soft up close. Boats on screen use a full-sharpness
// picture of just the directions in use, loaded on first use; the atlas frame stands in until it arrives.
const SHARP_KEEP = 12;
const textureFiles = new WeakMap();
function createSharpCache({load=file=>Assets.load(art(DIR+file)),unload=file=>Assets.unload(DIR+file),now=()=>performance.now()}={}) {
  const cache = new Map(), unloading = new Map();
  let sweptAt = -Infinity;
  const drop = file => {
    cache.delete(file);
    // a reload of the same file waits for this unload, so it never gets the texture being destroyed
    const done = Promise.resolve().then(()=>unload(file)).catch(()=>{}).finally(()=>{if(unloading.get(file)===done)unloading.delete(file);});
    unloading.set(file,done);
  };
  const sweep = t => {
    if (cache.size <= SHARP_KEEP || t-sweptAt < 500) return;
    sweptAt = t;
    const idle = [...cache].filter(([,e])=>e.texture&&t-e.used>2000).sort((a,b)=>a[1].used-b[1].used);
    for (const [file] of idle.slice(0,cache.size-SHARP_KEEP)) drop(file);
  };
  return {
    get(texture) {
      const file = texture && textureFiles.get(texture);
      if (!file) return texture;
      const t = now();
      let entry = cache.get(file);
      if (!entry) {
        entry = {texture:null,used:t};cache.set(file,entry);
        (unloading.get(file)??Promise.resolve()).then(()=>load(file)).then(loaded=>{
          if (cache.get(file)===entry&&!loaded.destroyed) entry.texture=loaded;
          else if (cache.get(file)!==entry) drop(file);
        }).catch(()=>{if(cache.get(file)===entry)cache.delete(file);});
      }
      entry.used = t;
      sweep(t);
      return entry.texture&&!entry.texture.destroyed ? entry.texture : texture;
    },
  };
}

const diff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

function fromManifest(m,atlas) {
  const textures=new Map();
  const frameTexture=file=>{
    if(!file)return null;
    if(!textures.has(file)){
      const f=atlas.frames.get(file);if(!f)throw Error(`Missing boat atlas frame ${file}`);
      const texture=new Texture({source:atlas.source,frame:new Rectangle(f.x,f.y,f.w,f.h),orig:new Rectangle(0,0,atlas.width,atlas.height),trim:new Rectangle(f.left,f.top,f.w,f.h)});
      textureFiles.set(texture,file);textures.set(file,texture);
    }
    return textures.get(file);
  };
  return manifestViews(m,frameTexture);
}

function manifestViews(m,frameTexture){
  return Object.entries(m.views).map(([key,v])=>{
    const deg=v.deg??v.heading??SECTOR[key],anchor=v.anchor??m.anchor??[.5,.82];
    const [sx,sy]=v.seat??m.seat??[LEGACY_SEAT.x,LEGACY_SEAT.y];
    return {key,texture:frameTexture(v.file),front:frameTexture(v.front),rigFront:frameTexture(v.rigFront),angle:deg*RAD,
      mirror:Boolean(v.mirror),anchor,width:v.width??m.width??255,seat:{x:sx,y:sy},transition:v.transition??m.transition??'cut'};
  });
}

async function legacy() {
  const texture = await Assets.load(art('/pixi-art/boat-sail.svg'));
  const one = (key, deg, mirror) => ({key, texture, angle: deg * RAD, mirror, anchor: [.5, .82], width: 255,
    seat: {x: mirror ? -LEGACY_SEAT.x : LEGACY_SEAT.x, y: LEGACY_SEAT.y}});
  return [one('e', 90, false), one('w', -90, true)];
}

let ready = null, prepared = null, manifestReady = null;
const loadManifest=()=>manifestReady??=(async()=>{
  const res=await fetch(`${DIR}views.json`,{cache:'no-cache'});
  if(!res.ok)throw Error('no boat views');
  const manifest=await res.json();
  if(!Object.keys(manifest.views??{}).length)throw Error('empty boat views');
  return manifest;
})();
async function initialViews(){
  const manifest=await loadManifest(),entries=Object.entries(manifest.views);
  const selected=entries.filter(([key])=>key==='f00'||key==='f24');
  const m={...manifest,views:Object.fromEntries(selected.length?selected:entries.slice(0,1))};
  const files=[...new Set(Object.values(m.views).flatMap(v=>[v.file,v.front,v.rigFront].filter(Boolean)))];
  const textures=new Map(await Promise.all(files.map(async file=>[file,await Assets.load(art(DIR+file))])));
  return manifestViews(m,file=>textures.get(file)??null);
}
export function loadBoatViews() {
  ready ??= initialViews().catch(()=>legacy()).then(initial => {
    let views=initial, byKey=new Map(views.map(v=>[v.key,v]));
    const sharp=createSharpCache();
    return {
      get views(){return views;},get byKey(){return byKey;},
      replace(next){views=next;byKey=new Map(views.map(v=>[v.key,v]));},
      pick(heading, current) {
        let best = views[0], bestD = Infinity;
        for (const v of views) {const d = diff(heading, v.angle); if (d < bestD) {best = v; bestD = d;}}
        const cur = current && byKey.get(current);
        if (cur && cur !== best && diff(heading, cur.angle) < bestD + HYST) return cur;
        return best;
      },
      // the picture to draw for a view: the sharp one once it has loaded, else the atlas frame
      best(v, texture = v.texture) {return sharp.get(texture);},
      apply(sprite, v, scaleMul = 1, texture = v.texture) {
        texture = sharp.get(texture);
        sprite.texture = texture;
        sprite.anchor.set(v.anchor[0], v.anchor[1]);
        const k = v.width / texture.width * scaleMul;
        sprite.scale.set(v.mirror ? -k : k, k);
      },
    };
  });
  return ready;
}

// Called after reveal. Two existing SVG directions remain usable
// while idle work prepares/uploads the 48-direction sheet, then swaps atomically.
export function prepareBoatViews(renderer,{buildAtlas=buildBoatAtlas,cancelled=()=>false}={}) {
  return prepared??= (async()=>{
    const bank=await loadBoatViews();
    const manifest=await loadManifest();
    const atlas=await buildAtlas(manifest,{cancelled});
    try{
      if(renderer)await uploadIsland(renderer,[],{sources:[atlas.source],cancelled});
      bank.replace(fromManifest(manifest,atlas));return bank;
    }catch(error){atlas.source.destroy();throw error;}
  })().catch(error=>{prepared=null;throw error;});
}
