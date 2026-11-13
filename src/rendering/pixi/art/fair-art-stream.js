import {DOMAdapter} from 'pixi.js';
import {cropFairSVG} from './fair-raster.js';
import {createRasterLoader} from './theme-art-stream.js';
import {prepareGroundSVG, rasterizeGroundTile} from './svg-ground-raster.js';

export function createFairGroundLoader() {
  return createRasterLoader({concurrency:8, frameBudgetMs:2, exactFrame:true,
    prepareSource:prepareGroundSVG, rasterize:rasterizeGroundTile});
}

export function createFairRasterLoader() {
  return createRasterLoader({cropParam:'fairCrop',concurrency:8,frameBudgetMs:2,
    rasterize:async(original,crop,resolution)=>{
      const svg=cropFairSVG(original,crop),adapter=DOMAdapter.get(),image=adapter.createImage();
      image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
      await image.decode();
      const canvas=adapter.createCanvas(Math.ceil(crop[4]*resolution),Math.ceil(crop[5]*resolution));
      const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
      context.drawImage(image,0,0,crop[4]*resolution,crop[5]*resolution);
      return canvas;
    }});
}
