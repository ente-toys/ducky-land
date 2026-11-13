import {DOMAdapter, extensions, ExtensionType, ImageSource, loadSvg, Texture} from 'pixi.js';
import {createArtQueue} from './island-preparation.js';

export const loadedSVGTextures=new Set();

export function createWholeSVGLoader({queue = createArtQueue(), fetchBlob = async src => {
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
    test: url => /\.svg(?:[?#]|$)/i.test(url) || url.startsWith('blob:'),
    load(src, asset = {}) {
      return queue.run(async () => {
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
