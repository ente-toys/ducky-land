import {Assets,Sprite,Texture} from 'pixi.js';
import {LEAF_TEXTURE} from '../plant-reactions.js';
import {createBushRustleObserver} from './bush-rustle.js';

export function loadBushRustleArt(){
  return import.meta.env?.BASE_URL?Assets.load(LEAF_TEXTURE):Promise.resolve(Texture.EMPTY);
}
const LIFE=.28,CAP=9;
export function createBushRustle(objects,texture,{tilt=1,playSound=()=>{}}={}){
  const leaves=Array.from({length:CAP},()=>{
    const sprite=new Sprite(texture);sprite.anchor.set(.5);sprite.visible=false;
    sprite.tint=0xa7cb60;sprite.upright=true;objects.addChild(sprite);
    return {sprite,at:-Infinity,x:0,y:0,direction:1};
  });
  let next=0,time=0;
  const observe=createBushRustleObserver({playSound,puff(x,y){
    for(let i=0;i<3;i++)Object.assign(leaves[next++%CAP],{at:time,x:x+(i-1)*10,y:y-12,direction:i-1});
  }});
  return {
    update(self,seconds,reducedMotion=false){
      time=seconds;observe(self,time,reducedMotion);
      for(const leaf of leaves){
        const u=(time-leaf.at)/LIFE,s=leaf.sprite;
        s.visible=!reducedMotion&&u>=0&&u<1;
        if(reducedMotion)leaf.at=-Infinity;
        if(!s.visible)continue;
        const out=1-(1-u)**3;
        s.position.set(leaf.x+leaf.direction*22*out,leaf.y-18*out+8*u*u);
        s.zIndex=leaf.y+30;s.scale.set(.6,.6/tilt);
        s.rotation=leaf.direction*(.4+out);s.alpha=(1-u)**2;
      }
    },
    dispose(){for(const {sprite}of leaves){sprite.removeFromParent();sprite.destroy();}},
  };
}
