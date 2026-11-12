import {Container,Sprite} from 'pixi.js';
import {createAutumnLeafPool} from './autumn-leaf-motion.js';
export function createAutumnLeaves(props,textures,settings={}){
 const layer=new Container({label:'Bellovo pooled falling leaves'});
 const mobile=(globalThis.matchMedia?.('(pointer: coarse)').matches??false)||
  (globalThis.matchMedia?.('(max-width: 768px)').matches??false);
 const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 const maxSprites=mobile?Math.min(48,settings.mobileMaxSprites??48,settings.maxSprites??96):Math.min(96,settings.maxSprites??96);
 const pool=createAutumnLeafPool(props.filter(p=>p.autumn?.kind==='tree'),i=>{
  const s=new Sprite(textures[i%textures.length]);s.anchor.set(.5);s.visible=false;layer.addChild(s);return s;
 },{mobile,maxSprites});
 return {...pool,layer,
  update(time,reduceMotion,visible,camera){pool.update(time,reduceMotion||reduced?.matches===true,visible,camera);},
  get stats(){return pool.stats;}
 };
}
