import {createServer} from 'vite';
import {writeFileSync,readFileSync} from 'node:fs';
const vite=await createServer({configFile:false,cacheDir:'/private/tmp/ducky-bigger-home-vite',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'error'});
try {const P=await vite.ssrLoadModule('/src/pixi/placements.js'),{geometry}=await vite.ssrLoadModule('/assets/world/island-geometry.mjs'),{sleepHalfWidths}=await vite.ssrLoadModule('/src/pixi/sleep-spots.js');
const world=P.trimWorld(JSON.parse(readFileSync('assets/world/world.json'))),props=P.createPlacements(world,geometry({...world,obstacles:[]}).walkable),local=P.walkWorld(world,props),grown={...world,coast:local.coast},old=geometry({...world,obstacles:[]}).walkable;
writeFileSync('/private/tmp/ducky-home-baseline.json',JSON.stringify({props,decals:[...P.decalsFor(world,props,old),...P.decalsFor(grown,props,geometry({...grown,obstacles:[]}).walkable).filter(d=>!old(d.x,d.y))],beds:P.sleepSpots(local,props,geometry(local).walkable,sleepHalfWidths())}));
console.log('Saved original props, decals and all 40 sleeper positions');}finally{await vite.close();}
