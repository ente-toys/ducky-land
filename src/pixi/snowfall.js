import {Container, Graphics} from 'pixi.js';

export const SNOW_POOL_SIZE = 144;
export const SNOW_PHONE_COUNT = 72;
export function snowVisible(theme, reduced, flat = true) {
  return theme === 'snow' && !reduced && flat;
}
// Three parallax depths, fixed opacity and continuous motion. Reserve both UI
// bands including the full flake radius, so even the largest flakes stay clear.
export function snowPose(index, time, width, height) {
  const depth=index%12, size=depth===0?11:depth<5?7:3.5;
  const speed=depth===0?31:depth<5?23:14;
  const margin=size/2, span=Math.max(1,height-160-size);
  const horizontal=Math.max(1,width-size);
  return {x:margin+((index*137.57+Math.sin(time*.32+index)*22)%horizontal+horizontal)%horizontal,
    y:80+margin+((index*83.31+time*speed)%span+span)%span,size};
}
export function createSnowfall(stage) {
  const root=new Container({label:'Iceland snowfall',eventMode:'none'});
  // Graphics share one immutable context, cached by Pixi; no per-frame drawing,
  // texture creation, filters, DOM work or particle allocations.
  const template=new Graphics().circle(0,0,.46).fill(0xfffdf8).stroke({color:0x9688b0,width:.08,alpha:.85});
  const flakes=Array.from({length:SNOW_POOL_SIZE},()=>{const s=new Graphics(template.context);s.alpha=.88;root.addChild(s);return s;});
  stage.addChild(root);root.visible=false;
  return {root,update(time,reduced,theme,width,height,flat){
    root.visible=snowVisible(theme,reduced,flat);if(!root.visible)return;
    const count=width<600?SNOW_PHONE_COUNT:SNOW_POOL_SIZE;
    flakes.forEach((s,i)=>{s.visible=i<count;if(!s.visible)return;const p=snowPose(i,time,width,height);s.position.set(p.x,p.y);s.scale.set(p.size);});
  },destroy(){root.destroy({children:true});template.destroy(true);}};
}
