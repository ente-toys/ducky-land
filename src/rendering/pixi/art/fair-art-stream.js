import {cropFairSVG} from './fair-raster.js';
import {createRasterLoader} from './theme-art-stream.js';
import {prepareGroundSVG, rasterizeGroundTile} from './svg-ground-raster.js';

export function createFairGroundLoader(options={}) {
  return createRasterLoader({...options,concurrency:8, frameBudgetMs:2, exactFrame:true,
    prepareSource:prepareGroundSVG, rasterize:rasterizeGroundTile,cacheSources:false});
}

export function createFairRasterLoader(options={}) {
  return createRasterLoader({...options,prepareSVG:cropFairSVG,cropParameter:'fairCrop'});
}
