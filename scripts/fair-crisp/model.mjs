import {fairTiles,FAIR_GROUND_TILE_SIZE} from '../../src/pixi/fair-raster.js';
import {tileInView,tileResolution} from '../../src/pixi/ground-stream.js';
export const base='/pixi-art/themes/fair/';
export const source=p=>p.src.startsWith('/')?p.src:base+p.src;
export function layers(art){return ['ground','decks','flats','props','floating'].flatMap(kind=>(kind==='ground'?art.ground.tiles:art[kind]??[]).map(p=>({p,kind,src:source(p),anchor:kind==='props'?p.anchor??{x:.5,y:1}:kind==='flats'&&!p.topLeft?{x:.5,y:1}:kind==='floating'?p.anchor??{x:.5,y:.5}:{x:0,y:0}})));}
export function planned(art){return layers(art).flatMap(({p,src,kind,anchor})=>{const tiles=fairTiles(p,src,anchor,kind==='ground'?FAIR_GROUND_TILE_SIZE:undefined).map(tile=>({...tile,kind,id:p.id??p.src}));return p.overBoats?[...tiles,...tiles.map(t=>({...t,overBoats:true}))]:tiles;});}
export function allocation(tiles,camera,width,height){const totals={ground:0,art:0},visible=[];for(const tile of tiles){if(!tileInView(tile,camera,width,height,1,tile.viewMargin))continue;const resolution=tileResolution(tile,camera.zoom,2),bytes=Math.ceil(tile.width*resolution)*Math.ceil(tile.height*resolution)*4;totals[tile.kind==='ground'?'ground':'art']+=bytes;visible.push({...tile,resolution,bytes});}return {...totals,visible};}
