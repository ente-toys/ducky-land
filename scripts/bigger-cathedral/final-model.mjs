import fs from 'node:fs';
import {rasterTiles,RASTER_GROUND_TILE_SIZE} from '../../src/pixi/theme-raster.js';
export const A='public/pixi-art/themes/cathedral/',D='rive/web/themes/cathedral/';
export const read=p=>JSON.parse(fs.readFileSync(p));
export function rasterLayers(art=read(A+'art.json')){
 const base='/pixi-art/themes/cathedral/',url=p=>p.src.startsWith('/')?p.src:base+p.src;
 return {
  ground:art.ground.tiles.flatMap(p=>rasterTiles(p,url(p),undefined,RASTER_GROUND_TILE_SIZE)).concat(art.flats.filter(p=>p.rasterPool==='ground').flatMap(p=>rasterTiles(p,url(p),p.topLeft?{x:0,y:0}:{x:.5,y:1}))),
  art:[...art.decks.flatMap(p=>Array.from({length:p.overBoats?2:1},()=>[p,{x:0,y:0}])),...art.flats.filter(p=>p.rasterPool!=='ground').map(p=>[p,p.topLeft?{x:0,y:0}:{x:.5,y:1}]),...art.props.map(p=>[p,p.anchor??{x:.5,y:1}]),...(art.floating??[]).map(p=>[p,p.anchor??{x:.5,y:.5}])].flatMap(([p,anchor])=>rasterTiles(p,url(p),anchor)),
 };
}
