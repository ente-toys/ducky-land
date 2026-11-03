import {Container,Graphics} from 'pixi.js';
export function birdPose(x,y,phase,time,reduced=false){
  return {x:x+(reduced?0:90*Math.sin(time*Math.PI/6+phase)),y:y+(reduced?0:28*Math.sin(time*Math.PI/3+phase*.7)),
    rotation:reduced?0:.13*Math.cos(time*Math.PI/6+phase),flap:reduced?.4:.4+.7*Math.sin(time*Math.PI*4+phase)};
}
export function createBird(){
  const root=new Container({label:'Ambient bird'}),wings=[];
  for(const side of [-1,1]){
    const wing=new Graphics().moveTo(0,0).bezierCurveTo(side*3,-22,side*19,-21,side*24,-11).bezierCurveTo(side*22,1,side*12,10,0,5).fill(0xfffdf3).stroke({color:0x232323,width:1.2});
    wing.x=side*4;wing.y=-1;root.addChild(wing);wings.push(wing);
  }
  root.addChild(new Graphics().ellipse(0,1,12,8.5).fill(0xfffdf3).stroke({color:0x232323,width:1.2})
    .poly([9,-4,18,0,10,5]).fill(0xf4c34d).stroke({color:0x232323,width:1}).circle(5,-3,1.5).fill(0x232323));
  return {root,wings};
}
