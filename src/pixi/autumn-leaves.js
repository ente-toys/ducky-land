import {Container,Sprite} from 'pixi.js';
import {createAutumnLeafPool} from './autumn-leaf-motion.js';
export function createAutumnLeaves(props,textures,settings){
 const layer=new Container({label:'Bellovo pooled falling leaves'});
 const mobile=globalThis.matchMedia?.('(pointer: coarse)').matches??false;
 const pool=createAutumnLeafPool(props.filter(p=>p.autumn?.kind==='tree'),i=>{
  const s=new Sprite(textures[i%textures.length]);s.anchor.set(.5);s.visible=false;layer.addChild(s);return s;
 },{mobile,maxSprites:settings.maxSprites});
 return {...pool,layer,get stats(){return pool.stats;}};
}
