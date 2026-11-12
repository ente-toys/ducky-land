import {Container,Graphics,Text} from 'pixi.js';
import {PALETTE} from '../shared/palette.js';
const durations={2:1.3,4:1.5,5:1.55,6:1.55,7:2.3,8:1.5,9:1.75};
export function bubblePose(action,time,reduced=false){
  const duration=durations[action];
  if(!duration||time<.08||time>=duration-.08)return {visible:false,alpha:0,scale:1,y:0};
  const alpha=Math.min(1,(time-.08)/.06,(duration-.08-time)/.1);
  return {visible:true,alpha,scale:reduced?1:1+Math.sin(Math.min(1,(time-.08)/.3)*Math.PI)*.12,y:action===7&&!reduced?-time/duration*64:0};
}
export function createDuckFeedback(isPlayer){
  const ring=new Graphics({label:'Player ring'}).ellipse(0,4,267,62.5).stroke({color:PALETTE.coral,width:16});
  ring.visible=Boolean(isPlayer);
  const bubble=new Container({label:'Emote bubble'});bubble.position.set(280,-660);bubble.visible=false;
  const card=new Graphics().poly([-142,22,-183,95,-89,22]).fill(0xffffff).stroke({color:0x232323,width:8})
    .roundRect(-187,-190,375,234,87).fill(0xffffff).stroke({color:0x232323,width:8});bubble.addChild(card);
  const icons=new Map();
  const text=(value,size)=>{const node=new Text({text:value,style:{fontFamily:'Arial,sans-serif',fontWeight:'900',fontSize:size,fill:0x232323}});node.anchor.set(.5);return node;};
  icons.set(2,text('QUACK!',70));
  const heart=new Graphics().moveTo(0,69).bezierCurveTo(-130,-18,-72,-110,0,-52).bezierCurveTo(72,-110,130,-18,0,69).fill(0xff669d).stroke({color:0x232323,width:8});
  heart.moveTo(-55,-30).quadraticCurveTo(-50,-49,-32,-49).stroke({color:0xffffff,width:7});icons.set(4,heart);
  const laugh=new Graphics().ellipse(-47,-27,9,13).ellipse(47,-27,9,13).fill(0x232323)
    .moveTo(-63,20).quadraticCurveTo(0,112,63,20).quadraticCurveTo(0,46,-63,20).fill(0x232323)
    .ellipse(0,58,22,9).fill(0xff814a);icons.set(5,laugh);
  const wave=new Graphics().poly([-45,55,-67,8,-60,-27,-43,-20,-47,-65,-28,-72,-15,-33,-9,-82,12,-83,19,-29,36,-63,54,-54,42,-7,61,-24,78,-6,52,51,4,72]).fill(0xf4d93b).stroke({color:0x232323,width:8});
  wave.moveTo(-102,-10).quadraticCurveTo(-125,-36,-102,-60).moveTo(96,-62).quadraticCurveTo(122,-39,105,-12).stroke({color:0x232323,width:8});icons.set(6,wave);
  icons.set(7,text('z z Z',88));
  const sleep=new Container({label:'Sleeping duck'});sleep.position.set(200,-690);sleep.visible=false;
  for(let i=0;i<3;i++){const z=text('z',58+i*12);z.x=i*36;z.y=-i*51;sleep.addChild(z);}
  const anger=new Graphics();for(const [x,y,sx,sy]of [[-64,-58,1,1],[65,-58,-1,1],[-65,57,1,-1],[65,57,-1,-1]])anger.moveTo(x,y).lineTo(x+sx*47,y+sy*6).lineTo(x+sx*44,y+sy*46);anger.stroke({color:0x232323,width:15});icons.set(8,anger);
  const party=new Graphics().poly([-65,60,0,-65,66,60]).fill(0x8e75dd).stroke({color:0x232323,width:7})
    .poly([-40,30,29,-20,44,13,-50,48]).fill(0xff669d).ellipse(0,-70,12,12).fill(0xff669d).stroke({color:0x232323,width:5});
  for(const [x,y,color]of [[-108,-54,0x4794d8],[109,-34,0xff814a],[-103,38,0x58bf43],[105,62,0xf4d93b]])party.rect(x,y,12,26).fill(color).stroke({color:0x232323,width:3});icons.set(9,party);
  for(const [action,icon]of icons){icon.label=`Bubble icon ${action}`;icon.y=-73;icon.visible=false;bubble.addChild(icon);}
  function update(action,time,reduced,persistentSleep=false){
    const pose=bubblePose(action,time,reduced);bubble.visible=pose.visible;bubble.alpha=pose.alpha;bubble.scale.set(pose.scale);bubble.y=-660+pose.y;
    card.tint=action===8?0xffe8e5:0xffffff;for(const [value,icon]of icons)icon.visible=value===action;
    bubble.emoteAction=pose.visible?action:0;
    sleep.visible=persistentSleep&&action===7;
    if(sleep.visible){
      bubble.visible=false;bubble.emoteAction=0;
      sleep.children.forEach((z,i)=>{const phase=(time*.28+i/3)%1;z.y=-i*51-(reduced?0:phase*32);z.alpha=reduced?.8:.4+Math.sin(phase*Math.PI)*.6;});
    }
  }
  return {ring,bubble,sleep,update};
}
