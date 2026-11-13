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
            const {resolution = 1, ...options} = asset.data ?? {};
            const canvas = DOMAdapter.get().createCanvas(Math.ceil(image.width * resolution), Math.ceil(image.height * resolution));
            const context = canvas.getContext('2d');
            context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
            context.drawImage(image, 0, 0, image.width * resolution, image.height * resolution);
            const source=new ImageSource({resource: canvas, resolution,
              alphaMode: 'premultiply-alpha-on-upload', ...options});
            // ImageSource overrides this flag in its constructor in Pixi 8.22.
            source.autoGarbageCollect=false;
            source.label=src;source._sourceOrigin=src;
            const texture=new Texture({source,label:src});
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
