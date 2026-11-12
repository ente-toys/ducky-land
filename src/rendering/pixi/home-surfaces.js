import {Container} from 'pixi.js';
export function createHomeBoatLayer(scene,decks){
 const boats=new Container({sortableChildren:true,label:'Home boats below decks'});
 scene.addChildAt(boats,scene.getChildIndex(decks));
 return boats;
}
export const homeActorLayer=(scene,mode)=>mode==='sailing'?scene.homeBoats:scene.objects;
