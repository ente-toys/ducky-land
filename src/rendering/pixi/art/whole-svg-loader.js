import {DOMAdapter, extensions, ExtensionType, ImageSource, loadSvg, Rectangle, Texture} from 'pixi.js';
import {recoverArt, artPlaceholder, isArtPlaceholder, finalTextureSource} from './art-recovery.js';
import {createArtQueue} from './island-preparation.js';
import {textureFootprint} from './texture-footprint.js';
import sourceSizes from '../../shared/art-source-sizes.json' with {type:'json'};

export const loadedSVGTextures=new Set();

const manifestURL=typeof __PRERENDER_ART_MANIFEST__==='string'?__PRERENDER_ART_MANIFEST__:null;
let manifestPromise;
const loadPrerenderManifest=()=>manifestPromise??=(manifestURL?DOMAdapter.get().fetch(manifestURL)
  .then(response=>response.ok?response.json():{}).catch(()=>({})):Promise.resolve({}));

export function selectPrerenderTier(manifest, src, resolution=1) {
  // Query parameters can describe an SVG crop or another generated drawing.
  // Only an exact authored-source match is safe to substitute.
  const entry=manifest?.[src];
  if(!entry||!(entry.w>0&&entry.h>0)||!Array.isArray(entry.tiers))return null;
  const tier=entry.tiers.filter(t=>t.scale>=resolution&&typeof t.url==='string')
    .sort((a,b)=>a.scale-b.scale)[0];
  return tier?{...entry,...tier}:null;
}

export function createWholeSVGLoader({queue = createArtQueue(), getManifest=loadPrerenderManifest,
  decodeBitmap=(blob,{crop,...options})=>crop?globalThis.createImageBitmap(blob,...crop,options):globalThis.createImageBitmap(blob,options),
  canDecodeBitmap=()=>typeof globalThis.createImageBitmap==='function', fetchBlob = async src => {
  const response = await DOMAdapter.get().fetch(src);
  if (!response.ok) throw Error(`SVG ${response.status}: ${src}`);
  return response.blob();
}, decode = async blob => {
  const image = DOMAdapter.get().createImage(), url = URL.createObjectURL(blob);
  try {image.src = url; await image.decode(); return image;}
  finally {URL.revokeObjectURL(url);}
}} = {}) {
  const makeTexture=(resource,src,resolution,options,f)=>{
    const source=new ImageSource({resource,resolution,...options});
    source.autoGarbageCollect=false;source.label=src;source._sourceOrigin=src;
    if(typeof resource.close==='function')source.once('destroy',()=>resource.close());
    const texture=new Texture({source,label:src,
      orig:new Rectangle(0,0,f.fullWidth/resolution,f.fullHeight/resolution),
      trim:new Rectangle(f.x/resolution,f.y/resolution,f.width/resolution,f.height/resolution)});
    loadedSVGTextures.add(texture);texture.once('destroy',()=>loadedSVGTextures.delete(texture));
    return texture;
  };
  return {
    extension: {type: ExtensionType.LoadParser, priority: 100, name: 'wholeIslandSVG'},
    name: 'wholeIslandSVG',
    test: url => /\.svg(?:[?#]|$)/i.test(url) || url.startsWith('blob:') || /^data:image\/svg\+xml[,;]/i.test(url),
    load(src, asset = {}) {
      const urgent=Boolean(asset.data?.urgent);
      return queue.run(() => recoverArt(async () => {
        const {resolution=1,groundPadding=0,urgent:_,...options}=asset.data??{};
        const key=asset.src??src;
        // Fully transparent authored pieces have no ink to decode or upload.
        const empty=sourceSizes[key]&&textureFootprint(key,resolution,groundPadding);
        if(empty?.empty)return queue.raster(()=>{
          const texture=makeTexture(DOMAdapter.get().createCanvas(1,1),src,resolution,options,empty);
          if(groundPadding)texture.groundPadding={pad:groundPadding,width:empty.fullWidth-2*groundPadding,height:empty.fullHeight-2*groundPadding};
          return texture;
        },{urgent});
        // Pixi passes an absolute fetch URL; asset.src retains the authored key.
        const manifest=canDecodeBitmap()?await recoverArt(getManifest,{label:'Island prerender manifest; using SVG',timeoutMs:1000,fallback:()=>({})}):{};
        const tier=canDecodeBitmap()?selectPrerenderTier(manifest,asset.src??src,resolution):null;
        if(tier&&(!groundPadding||tier.padding===groundPadding)) {
          let bitmap;
          try {
            const pad=tier.padding??0;
            const fullWidth=(tier.width??Math.ceil(tier.w*tier.scale))+2*pad;
            const fullHeight=(tier.height??Math.ceil(tier.h*tier.scale))+2*pad;
            const width=Math.ceil(tier.w*resolution)+2*groundPadding;
            const height=Math.ceil(tier.h*resolution)+2*groundPadding;
            const blob=await fetchBlob(tier.url);
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
            if(groundPadding){
              // Resizing the padded picture scales its bleed too. Record the
              // exact inner rectangle so paths stay at authored coordinates.
              const padX=pad*width/fullWidth,padY=pad*height/fullHeight;
              texture.groundPadding={pad:groundPadding,padX,padY,width:width-2*padX,height:height-2*padY};
            }
            return texture;
          } catch(error) {bitmap?.close();console.warn(`${src}: prerender unavailable; using SVG`,error.message);}
        }
        const image = await decode(await fetchBlob(src));
        try {
          return await queue.raster(() => {
            const {resolution = 1, groundPadding = 0, urgent:_, ...options} = asset.data ?? {};
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
          },{urgent});
        } finally {image.src = '';}
      },{label:src,valid:texture=>!!finalTextureSource(texture),fallback:artPlaceholder,late:texture=>texture.destroy(!isArtPlaceholder(texture))}),{urgent});
    },
    unload(texture) {texture.destroy(!isArtPlaceholder(texture));},
  };
}

// Replace Pixi's text -> percent-encoded SVG path for every authored SVG,
// including shared Duckies and travel effects, before the first Assets.load.
export const wholeSVGLoader = createWholeSVGLoader();
extensions.remove(loadSvg);
extensions.add(wholeSVGLoader);
