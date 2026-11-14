import {build} from 'esbuild';
const entry=`
import raw from './assets/world/world.json';
import art from './src/world/home/art-manifest.json';
import {geometry} from './assets/world/island-geometry.mjs';
import {createPlacements,homeDecals,trimWorld,HOME_TILES,HOME_DECKS,HOME_GROUND_DECALS,JETTIES} from './src/world/home/placements.js';
const world=trimWorld(raw),props=createPlacements(world,geometry({...world,obstacles:[]}).walkable);
export {WORLD_ISLANDS} from './src/world/world-map.js';
export {mapFor} from './src/world/island-maps.js';
export const tiles=HOME_TILES;
export const entries=[...JETTIES,...HOME_DECKS,...props,...art.floating,{src:'/pixi-art/water-texture.svg'},
{ground:true,src:'/pixi-art/lake-race.svg',width:1500,height:950,resolution:1},{ground:true,src:'/pixi-art/decals/plaza-paving.svg',width:980,height:780,resolution:1},...homeDecals(props).map(d=>({...d,resolution:2.5,ground:true})),...HOME_GROUND_DECALS.map(d=>({...d,resolution:2.5,ground:true}))];`;
const bundled=await build({stdin:{contents:entry,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
export const home=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
