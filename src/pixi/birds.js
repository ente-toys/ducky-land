import {Container,Graphics} from 'pixi.js';
import {PALETTE} from './palette.js';
export function birdPose(x,y,phase,time,reduced=false){
  return {x:x+(reduced?0:90*Math.sin(time*Math.PI/6+phase)),y:y+(reduced?0:28*Math.sin(time*Math.PI/3+phase*.7)),
    rotation:reduced?0:.13*Math.cos(time*Math.PI/6+phase),flap:reduced?.4:.4+.7*Math.sin(time*Math.PI*4+phase)};
}
export function createBird(){
  const root=new Container({label:'Ambient bird'}),wings=[];
  for(const side of [-1,1]){
    const wing=new Graphics().moveTo(0,0).bezierCurveTo(side*3,-22,side*19,-21,side*24,-11).bezierCurveTo(side*22,1,side*12,10,0,5).fill(PALETTE.cream).stroke({color:PALETTE.ink,width:1.2});   // boss 3 Nov: palette gulls
    wing.x=side*4;wing.y=-1;root.addChild(wing);wings.push(wing);
  }
  root.addChild(new Graphics().ellipse(0,1,12,8.5).fill(PALETTE.cream).stroke({color:PALETTE.ink,width:1.2})
    .poly([9,-4,18,0,10,5]).fill(PALETTE.sun).stroke({color:PALETTE.ink,width:1}).circle(5,-3,1.5).fill(PALETTE.ink));
  return {root,wings};
}

export function crowPose({x,y,rx,ry,phase,speed},time,reduced=false) {
  const flightHeight = 220;
  const angle = phase + (reduced ? 0 : time * speed);
  const glide = Math.max(0, Math.min(1, (Math.sin(angle * 2 + phase) - .05) * 3));
  const flap = .55 + .4 * Math.cos(time * 13 + phase);
  return {
    x:x + rx * Math.cos(angle),
    y:y - flightHeight + ry * Math.sin(angle) + 22 * Math.sin(angle * 2),
    heading:Math.atan2(ry * Math.cos(angle) + 44 * Math.cos(angle * 2), -rx * Math.sin(angle)),
    flap:reduced ? .92 : flap + (.92 - flap) * glide,
  };
}

export function createCrow() {
  const root = new Container({label:'Flying crow'});
  const wings = [-1, 1].map(side => {
    const wing = new Graphics()
      .moveTo(8,0).bezierCurveTo(14,side*18,9,side*30,-4,side*44)
      .lineTo(-16,side*51).lineTo(-14,side*42).lineTo(-24,side*44)
      .lineTo(-20,side*34).lineTo(-28,side*34).lineTo(-22,side*23)
      .quadraticCurveTo(-17,side*10,-13,0).closePath()
      .fill(0x272B3C).stroke({color:0x181A26,width:2,join:'round'})
      .moveTo(4,side*9).quadraticCurveTo(-1,side*26,-14,side*37)
      .stroke({color:0x49516B,width:2,cap:'round'});
    root.addChild(wing);
    return wing;
  });
  root.addChild(new Graphics()
    .poly([-17,-6,-37,-13,-42,-5,-43,5,-37,13,-17,6])
    .fill(0x272B3C).stroke({color:0x181A26,width:2,join:'round'})
    .ellipse(-3,0,23,11).fill(0x34384A).stroke({color:0x181A26,width:2})
    .ellipse(19,0,12,9).fill(0x25293A)
    .poly([26,-5,40,0,26,5]).fill(0x161824)
    .circle(21,-4,1.7).fill(0xE8DBB5));
  return {root,wings};
}
