import {loadRasterDetail} from './raster-detail.js';
import {selectIslandTier} from '../../../app/ducky-prefetch.js';
import {createManifestParts} from './manifest-parts.js';
import {decodeArtBitmap} from './sheet-preparation.js';
import {activeIslandTiers,plannedSheetTiers,pinnedSheetTiers} from './island-budget.js';
import {DOMAdapter, extensions, ExtensionType, ImageSource, loadSvg, Rectangle, Texture} from 'pixi.js';
import {recoverArt, artPlaceholder, isArtPlaceholder, finalTextureSource} from './art-recovery.js';
import {createArtQueue,mapArtInFrames} from './island-preparation.js';
import {textureFootprint} from './texture-footprint.js';
import sourceSizes from '../../shared/art-source-sizes.json' with {type:'json'};

export const loadedSVGTextures=new Set();
let detailSerial=0;

const manifestURL=typeof __PRERENDER_ART_MANIFEST__==='string'?__PRERENDER_ART_MANIFEST__:null;
const manifestParts=createManifestParts(manifestURL);
export const loadPrerenderManifest=(sources=[],islandURL)=>recoverArt(()=>manifestParts(sources,islandURL),
  {label:'Island prerender manifest; using SVG',timeoutMs:30000,fallback:()=>({})});

export function selectPrerenderTier(manifest, src, resolution=1) {
  // Query parameters can describe an SVG crop or another generated drawing.
  // Only an exact authored-source match is safe to substitute.
  const entry=manifest?.[src];
  if(!entry||!(entry.w>0&&entry.h>0)||!Array.isArray(entry.tiers))return null;
  const planned=plannedSheetTiers.get(manifest)?.get(src);
  if(planned&&(pinnedSheetTiers.get(manifest)?.has(src)||planned.scale===resolution))return {...entry,...planned};
  const tier=entry.tiers.filter(t=>t.scale>=resolution-1e-10&&typeof t.url==='string')
    .sort((a,b)=>a.scale-b.scale)[0];
  return tier?{...entry,...tier}:null;
}

export function createWholeSVGLoader({queue = createArtQueue(), getManifest=loadPrerenderManifest,
  decodeBitmap=decodeArtBitmap,
  canDecodeBitmap=()=>typeof globalThis.createImageBitmap==='function', fetchBlob = async (src, {priority='high',signal}={}) => {
  const response = await DOMAdapter.get().fetch(src, {priority,signal});
  if (!response.ok) throw Error(`SVG ${response.status}: ${src}`);
  return response.blob();
}, decode = async blob => {
  const image = DOMAdapter.get().createImage(), url = URL.createObjectURL(blob);
  try {image.src = url; await image.decode(); return image;}
  finally {URL.revokeObjectURL(url);}
}} = {}) {
  const sheets=new Map();
  const blobs=new Map();
  const sheetBlob=(url,priority='high',signal)=>{
    let held=blobs.get(url);
    if(held?.signal?.aborted){blobs.delete(url);held=undefined;}
    if(!held){
      held={signal};blobs.set(url,held);
      held.promise=Promise.resolve().then(()=>fetchBlob(url,{priority,...(signal?{signal}:{})})).catch(error=>{
        if(blobs.get(url)===held)blobs.delete(url);throw error;
      });
    }
    return held.promise;
  };
  const ensureSheet=(tier,options={})=>{
    let held=sheets.get(tier.sheet);
    if(held?.signal?.aborted&&!held.source){sheets.delete(tier.sheet);held=undefined;}
    if(!held){
      held={count:0,pins:0,signal:options.signal};sheets.set(tier.sheet,held);
      held.promise=(async()=>{
        const resource=await decodeBitmap(await sheetBlob(tier.sheet,options.priority,options.signal),{premultiplyAlpha:'premultiply'});
        const source=new ImageSource({resource,resolution:1,autoGenerateMipmaps:!(tier.padding||tier.group?.includes('/ground/')),alphaMode:'premultiplied-alpha'});
        source.autoGarbageCollect=false;source.label=tier.sheet;source._sourceOrigin=tier.sheet;
        source.once('destroy',()=>resource.close?.());held.source=source;
        if(blobs.get(tier.sheet)?.signal===options.signal)blobs.delete(tier.sheet);
        return source;
      })().catch(error=>{
        if(blobs.get(tier.sheet)?.signal===options.signal)blobs.delete(tier.sheet);
        if(sheets.get(tier.sheet)===held)sheets.delete(tier.sheet);throw error;
      });
    }
    return held;
  };
  const freeSheet=(tier,held)=>{
    if(!held.count&&!held.pins&&held.source){if(sheets.get(tier.sheet)===held)sheets.delete(tier.sheet);held.source.destroy();}
  };
  const makeTexture=(resource,src,resolution,options,f)=>{
    const source=new ImageSource({resource,resolution,...options});
    source.autoGarbageCollect=false;source.label=src;source._sourceOrigin=src;
    if(typeof resource.close==='function')source.once('destroy',()=>resource.close());
    const texture=new Texture({source,label:src,dynamic:true,
      orig:new Rectangle(0,0,f.fullWidth/resolution,f.fullHeight/resolution),
      trim:new Rectangle(f.x/resolution,f.y/resolution,f.width/resolution,f.height/resolution)});
    texture.releaseAtlas=()=>{if(!source.destroyed)source.destroy();};
    loadedSVGTextures.add(texture);texture.once('destroy',()=>loadedSVGTextures.delete(texture));
    return texture;
  };
  return {
    async installDetailSheets(result,detail,{signal}={}){
      const installed=[];
      try{
        await mapArtInFrames(result.sheets,async(sheet,i)=>{
          const key=`raster-detail:${++detailSerial}`,resource=result.bitmaps[i];
          const source=new ImageSource({resource,resolution:1,autoGenerateMipmaps:!sheet.ground,alphaMode:'premultiplied-alpha'});
          source.autoGarbageCollect=false;source.label=key;source._sourceOrigin=key;source.once('destroy',()=>resource.close());
          const held={source,count:0,pins:1,promise:Promise.resolve(source)};sheets.set(key,held);installed.push([key,held]);
          await mapArtInFrames(sheet.frames,p=>detail.set(p.src,{scale:p.scale,sheet:key,url:key,group:`svg/${sheet.ground?'ground':'props'}/0`,
            padding:p.padding,width:Math.ceil(p.w*p.scale),height:Math.ceil(p.h*p.scale),
            x:p.x,y:p.y,frameWidth:p.f.width,frameHeight:p.f.height,offsetX:p.f.x,offsetY:p.f.y,
            sheetWidth:sheet.width,sheetHeight:sheet.height}),{frameBudgetMs:8,batchSize:128,cancelled:()=>signal?.aborted});
        },{frameBudgetMs:8,batchSize:128,cancelled:()=>signal?.aborted});
        signal?.throwIfAborted();
      }catch(error){for(const [key,h]of installed){h.pins--;freeSheet({sheet:key},h);}result.bitmaps.forEach(b=>b.close());throw error;}
      let released=false;
      return ()=>{if(released)return;released=true;for(const [key,h]of installed){h.pins--;freeSheet({sheet:key},h);}};
    },
    async prepareTiers(tiers,{priority='high',signal}={}) {
      signal?.throwIfAborted();
      const all=[...new Map(tiers.map(t=>[t.sheet??t.url,t])).values()],unique=all.filter(t=>t.sheet);
      signal?.throwIfAborted();
      // Launch every fetch before waiting for any decode or frame construction.
      for(const tier of all)void sheetBlob(tier.sheet??tier.url,priority,signal).catch(()=>{});
      const held=unique.map(t=>{const h=ensureSheet(t,{priority,signal});h.pins++;return h;});
      await Promise.allSettled(held.map(h=>h.promise));
      const release=()=>{unique.forEach((tier,i)=>{held[i].pins--;freeSheet(tier,held[i]);});for(const tier of all)if(!tier.sheet)blobs.delete(tier.url);};
      if(signal?.aborted){release();signal.throwIfAborted();}
      return release;
    },
    extension: {type: ExtensionType.LoadParser, priority: 100, name: 'wholeIslandSVG'},
    name: 'wholeIslandSVG',
    test: url => /\.svg(?:[?#]|$)/i.test(url) || /\/pixi-art\/themes\/bog(?:-arena)?\/.*\.png(?:[?#]|$)/i.test(url) || url.startsWith('blob:') || /^data:image\/svg\+xml[,;]/i.test(url),
    load(src, asset = {}) {
      return queue.run(() => recoverArt(async () => {
        asset.data?.signal?.throwIfAborted();
        const {resolution=1,groundPadding=0,prerenderTier,priority='high',signal,...options}=asset.data??{};
        const key=asset.data?.prerenderSource??asset.src??src;
        // Fully transparent authored pieces have no ink to decode or upload.
        const empty=sourceSizes[key]&&textureFootprint(key,resolution,groundPadding);
        if(empty?.empty)return queue.raster(()=>{
          const texture=makeTexture(DOMAdapter.get().createCanvas(1,1),src,resolution,options,empty);
          if(groundPadding)texture.groundPadding={pad:groundPadding,width:empty.fullWidth-2*groundPadding,height:empty.fullHeight-2*groundPadding};
          return texture;
        });
        // Pixi passes an absolute fetch URL; asset.src retains the authored key.
        const manifest=canDecodeBitmap()?await recoverArt(()=>getManifest([key]),{label:'Island prerender manifest; using SVG',timeoutMs:1000,fallback:()=>({})}):{};
        const tier=prerenderTier??(canDecodeBitmap()?selectPrerenderTier(manifest,key,resolution):null);
        if(tier&&(!groundPadding||tier.padding===groundPadding)) {
          let bitmap;
          try {
            if(tier.sheet){
              try {
                const held=ensureSheet(tier,{...options,priority,signal});
                held.count++;
                try{
                  const source=await held.promise,pad=tier.padding??0,r=tier.scale;
                  const crop=pad&&!groundPadding?pad:0;
                  const fullWidth=tier.width+2*pad,fullHeight=tier.height+2*pad;
                  const left=Math.max(tier.offsetX??0,crop),top=Math.max(tier.offsetY??0,crop);
                  const right=Math.min((tier.offsetX??0)+tier.frameWidth,fullWidth-crop);
                  const bottom=Math.min((tier.offsetY??0)+tier.frameHeight,fullHeight-crop);
                  const texture=new Texture({source,label:src,dynamic:true,
                    frame:new Rectangle(tier.x+left-(tier.offsetX??0),tier.y+top-(tier.offsetY??0),right-left,bottom-top),
                    orig:new Rectangle(0,0,fullWidth-2*crop,fullHeight-2*crop),
                    trim:new Rectangle(left-crop,top-crop,right-left,bottom-top)});
                  // TextureSource resolution belongs to the sheet. Frame geometry
                  // uses a per-texture coordinate scale, shared by all its sprites.
                  texture.orig.width/=r;texture.orig.height/=r;
                  texture.trim.x/=r;texture.trim.y/=r;texture.trim.width/=r;texture.trim.height/=r;
                  texture.updateUvs();
                  if(groundPadding)texture.groundPadding={pad:groundPadding,padX:pad/r,padY:pad/r,width:tier.width/r,height:tier.height/r};
                  texture.atlasFrame=true;
                  let released=false;
                  texture.releaseAtlas=()=>{if(released)return;released=true;held.count--;freeSheet(tier,held);};
                  texture.artKey=key;texture.artTier=tier;texture.artGroundPadding=groundPadding;
                  loadedSVGTextures.add(texture);
                  texture.once('destroy',()=>{
                    loadedSVGTextures.delete(texture);
                    texture.releaseAtlas();
                  });
                  return texture;
                }catch(error){
                  held.count--;freeSheet(tier,held);
                  throw error;
                }
              }catch(error){if(signal?.aborted)throw error;console.warn(`${src}: sheet unavailable; using piece`,error.message);}
            }
            const pad=tier.padding??0;
            const fullWidth=(tier.width??Math.ceil(tier.w*tier.scale))+2*pad;
            const fullHeight=(tier.height??Math.ceil(tier.h*tier.scale))+2*pad;
            const width=Math.ceil(tier.w*resolution)+2*groundPadding;
            const height=Math.ceil(tier.h*resolution)+2*groundPadding;
            const blob=await sheetBlob(tier.url,priority,signal);blobs.delete(tier.url);
            // A source used by both a prop and the ground may have a padded
            // tier. Crop it during decode for an ordinary unpadded texture.
            const decodeOptions={premultiplyAlpha:'premultiply',resizeWidth:width,resizeHeight:height,resizeQuality:'high'};
            bitmap=pad&&!groundPadding
              ?await decodeBitmap(blob,{...decodeOptions,crop:[pad,pad,fullWidth-2*pad,fullHeight-2*pad]})
              :await decodeBitmap(blob,decodeOptions);
            const footprint=textureFootprint(key,resolution,groundPadding,{[key]:[tier.w,tier.h]});
            if(footprint.x||footprint.y||footprint.width!==width||footprint.height!==height){
              const full=bitmap;
              try {bitmap=await decodeBitmap(full,{crop:[footprint.x,footprint.y,footprint.width,footprint.height],premultiplyAlpha:'premultiply'});}
              finally {full.close();}
            }
            const texture=makeTexture(bitmap,src,resolution,{...options,alphaMode:'premultiplied-alpha'},footprint);
            texture.artKey=key;texture.artTier=tier;texture.artGroundPadding=groundPadding;
            if(groundPadding){
              // Resizing the padded picture scales its bleed too. Record the
              // exact inner rectangle so paths stay at authored coordinates.
              const padX=pad*width/fullWidth,padY=pad*height/fullHeight;
              texture.groundPadding={pad:groundPadding,padX,padY,width:width-2*padX,height:height-2*padY};
            }
            return texture;
          } catch(error) {bitmap?.close();if(signal?.aborted)throw error;console.warn(`${src}: prerender unavailable; using SVG`,error.message);}
        }
        const image = await decode(await fetchBlob(src,{priority,...(signal?{signal}:{})}));
        try {
          return await queue.raster(() => {
            const {resolution = 1, groundPadding = 0, ...options} = asset.data ?? {};
            const width=Math.ceil(image.width*resolution),height=Math.ceil(image.height*resolution),pad=groundPadding;
            const canvas = DOMAdapter.get().createCanvas(width+2*pad,height+2*pad);
            const context = canvas.getContext('2d');
            context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
            // Fill the last texel completely even at a fractional resolution.
            context.drawImage(image, pad, pad, width, height);
            if(pad){
              context.imageSmoothingEnabled=false;
              context.drawImage(canvas,pad,pad,1,height,0,pad,pad,height);
              context.drawImage(canvas,pad+width-1,pad,1,height,pad+width,pad,pad,height);
              context.drawImage(canvas,0,pad,canvas.width,1,0,0,canvas.width,pad);
              context.drawImage(canvas,0,pad+height-1,canvas.width,1,0,pad+height,canvas.width,pad);
            }
            const footprint=textureFootprint(key,resolution,pad,{[key]:[image.width,image.height]});
            let resource=canvas;
            if(footprint.x||footprint.y||footprint.width!==canvas.width||footprint.height!==canvas.height){
              resource=DOMAdapter.get().createCanvas(footprint.width,footprint.height);
              resource.getContext('2d').drawImage(canvas,footprint.x,footprint.y,footprint.width,footprint.height,0,0,footprint.width,footprint.height);
              canvas.width=canvas.height=1;
            }
            const texture=makeTexture(resource,src,resolution,{alphaMode:'premultiply-alpha-on-upload',...options},footprint);
            if(pad)texture.groundPadding={pad,width,height};
            return texture;
          });
        } finally {image.src = '';}
      },{label:src,cancelled:()=>asset.data?.signal?.aborted,valid:texture=>!!finalTextureSource(texture),fallback:artPlaceholder,late:texture=>texture.destroy(!isArtPlaceholder(texture)&&!texture.atlasFrame)}));
    },
    unload(texture) {texture.destroy(!isArtPlaceholder(texture)&&!texture.atlasFrame);},
  };
}

// Replace Pixi's text -> percent-encoded SVG path for every authored SVG,
// including shared Duckies and travel effects, before the first Assets.load.
export const wholeSVGLoader = createWholeSVGLoader();
extensions.remove(loadSvg);
extensions.add(wholeSVGLoader);

let islandIndex;
const getIslandIndex=()=>islandIndex??=fetch('/art-prerender/islands.json',{cache:'no-cache'})
  .then(r=>{if(!r.ok)throw Error('Island index unavailable');return r.json();})
  .then(p=>fetch(p.url)).then(r=>{if(!r.ok)throw Error('Island index unavailable');return r.json();})
  .catch(e=>{islandIndex=undefined;throw e;});

export function createIslandPreparer({getIndex=getIslandIndex,getManifest=loadPrerenderManifest,
  loader=wholeSVGLoader,renderDetail=loadRasterDetail,fetchGround=async url=>{
    const response=await fetch(url);if(!response.ok)throw Error(`Landing ground HTTP ${response.status}`);await response.arrayBuffer();
  },dpr=()=>Math.min(globalThis.devicePixelRatio||1,2)}={}) {
  const preparations=new Map();
  return function prepare(islandId,renderDPR=dpr()) {
    const key=islandId+':'+renderDPR;
    if(preparations.has(key))return preparations.get(key);
    const job=(async()=>{
      const index=await getIndex();
      const tier=selectIslandTier(index,islandId,renderDPR);
      if(!tier)throw Error(`Unknown island ${islandId}`);
      const groundReady=Promise.all((tier.ground??[]).map(fetchGround));
      groundReady.catch(()=>{});
      const manifest=await getManifest([],tier.manifest);
      const choose=urls=>{
        const set=new Set(urls),selected=new Map();
        for(const [src,e]of Object.entries(manifest)){
          const t=e.tiers.filter(t=>set.has(t.sheet??t.url)).sort((a,b)=>b.scale-a.scale)[0];
          if(t)selected.set(src,t);
        }
        return selected;
      };
      const landing=choose(tier.webp),detail=choose(tier.detail??tier.webp);
      const owner=Symbol(islandId);let svgRelease,svgActive=false;
      const activate=selected=>{
        const pinned=pinnedSheetTiers.get(manifest)??new Map(),planned=plannedSheetTiers.get(manifest)??new Map();
        const active=activeIslandTiers.get(manifest)??new Map();
        for(const [src,t]of selected){pinned.set(src,t);planned.set(src,t);active.set(src,{...t,owner});}
        pinnedSheetTiers.set(manifest,pinned);plannedSheetTiers.set(manifest,planned);
        if(index.version>=2)activeIslandTiers.set(manifest,active);
      };
      const deactivate=()=>{
        const active=activeIslandTiers.get(manifest);
        for(const [src,t]of active??[])if(t.owner===owner){active.delete(src);pinnedSheetTiers.get(manifest)?.delete(src);plannedSheetTiers.get(manifest)?.delete(src);}
        if(active?.size===0)activeIslandTiers.delete(manifest);
      };
      activate(landing);
      const [sheetResult,groundResult]=await Promise.allSettled([
        loader.prepareTiers([...landing].map(([src,t])=>({...manifest[src],...t}))),groundReady,
      ]);
      if(sheetResult.status==='rejected'||groundResult.status==='rejected'){
        if(sheetResult.status==='fulfilled')sheetResult.value();
        deactivate();throw sheetResult.reason??groundResult.reason;
      }
      const release=sheetResult.value;let released=false,landingReleased=false;
      const releaseLanding=()=>{if(!landingReleased){landingReleased=true;release();}};
      return {releaseLanding,tier,manifest,landing,detail,activate:()=>{svgActive=true;activate(detail);},
        prepareDetail:async({signal}={})=>{
          if(!tier.rasterDetail)return loader.prepareTiers([...detail].map(([src,t])=>({...manifest[src],...t})),{priority:'low',signal});
          const result=await renderDetail(tier.rasterDetail,{signal});
          if(released||signal?.aborted){result.bitmaps.forEach(b=>b.close());signal?.throwIfAborted();throw Error('Island released during detail preparation');}
          detail.clear();svgRelease?.();svgRelease=undefined;svgActive=false;
          const release=await loader.installDetailSheets(result,detail,{signal});
          if(released){release();throw Error('Island released during detail preparation');}
          svgRelease=release;
          return ()=>{if(!svgActive&&svgRelease===release){svgRelease=undefined;release();}};
        },
        release(){if(released)return;released=true;releaseLanding();svgRelease?.();svgRelease=undefined;preparations.delete(key);
          deactivate();
        }};
    })().catch(error=>{preparations.delete(key);throw error;});
    preparations.set(key,job);return job;
  };
}
const prepare=createIslandPreparer();
// Dev and node QA keep the SVG fallback and never request build-only files.
export const prepareIsland=(islandId,dpr)=>manifestURL?prepare(islandId,dpr):Promise.resolve({release(){}});
export const islandReady=prepareIsland;

export {getIslandIndex};
