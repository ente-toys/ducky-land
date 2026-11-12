import {Container,Graphics} from 'pixi.js';
import {PALETTE} from '../../shared/palette.js';
export function birdPose(x,y,phase,time,reduced=false){
  return {x:x+(reduced?0:90*Math.sin(time*Math.PI/6+phase)),y:y+(reduced?0:28*Math.sin(time*Math.PI/3+phase*.7)),
    rotation:reduced?0:.13*Math.cos(time*Math.PI/6+phase),flap:reduced?.4:.4+.7*Math.sin(time*Math.PI*4+phase)};
}
export const BIRD_KINDS=[
  {body:0xFBF5E8,tip:0x9A9A96,beak:0xF29A38},
  {body:0x6FA4DA,beak:0xF6C744},
  {body:0xF59A9A,crest:true},
];
function wingPath(g,side){
  const x=v=>v*side;
  return g.moveTo(0,-5).bezierCurveTo(x(8),-12,x(20),-11,x(25),-5).quadraticCurveTo(x(27),1,x(21),2).quadraticCurveTo(x(20),7,x(15),6)
    .quadraticCurveTo(x(12),10,x(7),8).quadraticCurveTo(x(3),10,0,7).closePath();
}
export function createBird(kind=0){
  const k=BIRD_KINDS[kind%BIRD_KINDS.length],ink={color:PALETTE.ink,width:1.4};
  const root=new Container({label:'Ambient bird'}),wings=[];
  for(const side of [-1,1]){
    const wing=wingPath(new Graphics(),side).fill(k.body);
    if(k.tip)wing.moveTo(side*18,-9.5).bezierCurveTo(side*22,-9,side*24.5,-7,side*25,-5).quadraticCurveTo(side*27,1,side*21,2).quadraticCurveTo(side*20,5,side*17,5.5).closePath().fill(k.tip);
    wingPath(wing,side).stroke(ink);
    wing.position.set(side*7,-1);root.addChild(wing);wings.push(wing);
  }
  const body=new Graphics();
  for(const tx of [-4,0,4])body.circle(tx,15,3.4);
  body.fill(k.body).stroke(ink);
  body.ellipse(0,3,11.5,12).circle(0,-7,9).stroke({...ink,width:2.8}).ellipse(0,3,11.5,12).circle(0,-7,9).fill(k.body);
  body.circle(-3.4,-8,1.5).circle(3.4,-8,1.5).fill(PALETTE.ink);
  if(k.beak)body.poly([-3,-14.5,0,-20,3,-14.5]).fill(k.beak).stroke({...ink,width:1.1});
  if(k.crest)body.moveTo(-1.5,-15).bezierCurveTo(-2,-22,1,-26,4.5,-24).bezierCurveTo(6.5,-22.5,5,-20,3,-21).bezierCurveTo(2,-19,1.5,-17,1.5,-15).closePath().fill(PALETTE.cream).stroke({...ink,width:1.1})
    .circle(4.2,-23.3,2.1).fill(PALETTE.ink);
  root.addChild(body);
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
