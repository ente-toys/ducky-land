import {DOMAdapter, extensions, ExtensionType, ImageSource, loadSvg, Texture} from 'pixi.js';
import {createArtQueue} from './island-preparation.js';

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
  return {
    extension: {type: ExtensionType.LoadParser, priority: 100, name: 'wholeIslandSVG'},
    name: 'wholeIslandSVG',
    test: url => /\.svg(?:[?#]|$)/i.test(url) || url.startsWith('blob:') || /^data:image\/svg\+xml[,;]/i.test(url),
    load(src, asset = {}) {
      return queue.run(async () => {
        const {resolution=1,groundPadding=0,...options}=asset.data??{};
        // Pixi passes an absolute fetch URL; asset.src retains the authored key.
        const tier=canDecodeBitmap()?selectPrerenderTier(await getManifest(),asset.src??src,resolution):null;
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
            const source=new ImageSource({resource:bitmap,resolution,...options,alphaMode:'premultiplied-alpha'});
            source.autoGarbageCollect=false;source.label=src;source._sourceOrigin=src;
            const owned=bitmap;source.once('destroy',()=>owned.close());
            const texture=new Texture({source,label:src});
            if(groundPadding){
              // Resizing the padded picture scales its bleed too. Record the
              // exact inner rectangle so paths stay at authored coordinates.
              const padX=pad*width/fullWidth,padY=pad*height/fullHeight;
              texture.groundPadding={pad:groundPadding,padX,padY,width:width-2*padX,height:height-2*padY};
            }
            loadedSVGTextures.add(texture);texture.once('destroy',()=>loadedSVGTextures.delete(texture));
            return texture;
          } catch {bitmap?.close(); /* A failed/missing build asset uses the authored SVG. */}
        }
        const image = await decode(await fetchBlob(src));
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
            const source=new ImageSource({resource: canvas, resolution,
              alphaMode: 'premultiply-alpha-on-upload', ...options});
            // ImageSource overrides this flag in its constructor in Pixi 8.22.
            source.autoGarbageCollect=false;
            source.label=src;source._sourceOrigin=src;
            const texture=new Texture({source,label:src});
            if(pad)texture.groundPadding={pad,width,height};
            loadedSVGTextures.add(texture);texture.once('destroy',()=>loadedSVGTextures.delete(texture));
            return texture;
          });
        } finally {image.src = '';}
      });
    },
    unload(texture) {texture.destroy(true);},
  };
}

// Replace Pixi's text -> percent-encoded SVG path for every authored SVG,
// including shared Duckies and travel effects, before the first Assets.load.
export const wholeSVGLoader = createWholeSVGLoader();
extensions.remove(loadSvg);
extensions.add(wholeSVGLoader);
