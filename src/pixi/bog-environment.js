import data from './bog-environment.json' with {type:'json'};
import {registerMap,THEME_OF,mapFor} from './island-maps.js';

export const BOG_MAP_ID='bog-arena';
// Reuse the existing Bog world identity ONLY inside the dedicated arena entry.
// Nothing is added to WORLD_ISLANDS, FINISHED_THEMES or the normal world UI.
export const BOG_REVIEW_ISLAND='isle-249';
export const BOG_AREAS=Object.freeze({
 'privacy-nw':{x:1900,y:1850},'google-ne':{x:6500,y:1850},
 'site-a':{x:2050,y:3770},'site-b':{x:6350,y:3770},
 'privacy-sw':{x:1900,y:5650},'google-se':{x:6500,y:5650},
 mid:{x:4200,y:2170},'lantern-cove':{x:4200,y:6870},
});
export function installBogEnvironment(){
 const previous=THEME_OF.get(BOG_REVIEW_ISLAND);
 if(!registerMap(BOG_MAP_ID,data))throw Error('Bog environment registration failed');
 THEME_OF.set(BOG_REVIEW_ISLAND,BOG_MAP_ID);
 return {map:mapFor(BOG_MAP_ID),islandId:BOG_REVIEW_ISLAND,restore(){
  THEME_OF.set(BOG_REVIEW_ISLAND,previous);registerMap(BOG_MAP_ID,null);
 }};
}
