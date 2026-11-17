import {createDuck} from '../rendering/pixi/duck.js';
import {prepareTreePixels,releaseArtPixels} from '../rendering/pixi/art/pixel-residency.js';

// Reuse the game's real rig. Draw eight stills once, with no new artwork or ticker.
let pictures;
export function prepareGuideEmotes(renderer){
 return pictures??=draw(renderer).catch(error=>{pictures=null;throw error;});
}
async function draw(renderer){
 const duck=await createDuck({outfit:{cap:0,shades:0,acc:0,shoes:0},seed:21});let sources=[];
 try{
  duck.root.scale.set(.22);sources=await prepareTreePixels(renderer,duck.root);
  const images={};
  for(const action of [2,3,4,5,6,7,8,9]){
   for(let frame=0;frame<36;frame++)duck.update(1/60,{action,turn:0,speed:0,time:action+frame/60});
   images[action]=await renderer.extract.base64({target:duck.root,resolution:1});
  }
  return images;
 }finally{for(const source of sources)releaseArtPixels(source);duck.dispose();}
}
