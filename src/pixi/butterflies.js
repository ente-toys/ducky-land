import {Container,Graphics} from 'pixi.js';
import {PALETTE} from './palette.js';

export function butterflyPose(x,y,phase,time,reduced=false){
  return {x:x+(reduced?0:44*Math.sin(time*.35+phase)),
    y:y+(reduced?0:20*Math.sin(time*.7+phase*.7)),
    rotation:reduced?0:.13*Math.cos(time*.35+phase),
    flap:reduced?1:.6+.36*Math.sin(time*15+phase)};
}

export function createButterfly(color){
  const root=new Container({label:'Butterfly'}),wings=[];
  for(const side of [-1,1]){
    const wing=new Graphics().moveTo(0,-2).bezierCurveTo(side*3,-22,side*23,-22,side*17,-3)
      .bezierCurveTo(side*24,12,side*8,20,0,3).closePath().fill(color).stroke({color:PALETTE.ink,width:1.2});   // boss 3 Nov: world ink, coral / sun wings
    wing.ellipse(side*10,-8,3,5).fill({color:PALETTE.cream,alpha:.45});
    root.addChild(wing);wings.push(wing);
  }
  const body=new Graphics().ellipse(0,0,2,7.5).fill(PALETTE.ink)
    .moveTo(-1,-5).quadraticCurveTo(-5,-14,-7,-12).moveTo(1,-5).quadraticCurveTo(5,-14,7,-12).stroke({color:PALETTE.ink,width:1});
  root.addChild(body);
  return {root,wings};
}
