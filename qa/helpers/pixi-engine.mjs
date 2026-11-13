import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const {outputFiles:[bundle]}=await build({entryPoints:[fileURLToPath(new URL('../../src/rendering/pixi/engine.js',import.meta.url))],bundle:true,packages:'external',platform:'node',format:'esm',write:false,define:{'import.meta.env.DEV':'false','import.meta.url':JSON.stringify(new URL('../../src/rendering/pixi/engine.js',import.meta.url).href)}});
let code=bundle.text.replaceAll('import.meta.glob(', '(()=>({}))(');
code=code.replaceAll('"pixi.js"',JSON.stringify(import.meta.resolve('pixi.js')));
export const {PixiIsland}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

// Exercise the real engine through scene placement, stopping before decorations.
// Art loading and GPU submission are the only boundaries replaced here.
export function cameraGame(player=null){
 const stop=new Error('camera frame complete');
 const game=Object.assign(Object.create(PixiIsland.prototype),{
  disposed:false,ready:true,lastFrame:0,frame:0,frameTimes:[],accumulator:0,islandId:'home',travelMode:'walking',
  keys:new Set(),touchInput:{x:0,y:0},sim:{time:2,player,step(){}},hadPlayer:Boolean(player),focusedActor:player?.id,
  motion:{matches:false},camera:{x:0,y:0,zoom:.7},target:{x:0,y:0,zoom:.7},zoomMotion:{velocity:0},minZoom:.12,
  width:1440,height:900,gestures:{pointers:new Map()},globeT:0,arts:new Map([['home',{ready:true}]]),artShown:'home',
  scene:{setFromMatrix(m){game.sceneMatrix=m;}},upright:{update(){}},ocean:{position:{set(){}},tilePosition:{set(){}}},
  weather:{update(){}},snowfall:{update(){throw stop;}},props:[],liveRigs:new Map(),
  stopInput(){},clearChat(){},updateControlLabel(){},ensureArt(){},ensurePondDuckies(){},releasePondDuckies(){},showArt(){},applyMapAmbience(){},buildCopies(){},
 });
 game.frameAt=now=>{try{game.tick(now);}catch(error){if(error!==stop)throw error;return;}throw Error('camera frame did not render');};
 return game;
}
