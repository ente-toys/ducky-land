import {Container,Graphics} from 'pixi.js';
export const windStrength=(time,reduced=false)=>reduced?0:.35+.65*(.5+.5*Math.sin(time*.38));
export function cloudPose(cloud,time,width,reduced=false){
  const t=reduced?0:time;
  return {x:((cloud.x+t*cloud.speed+500)%(width+1000))-500,y:cloud.y+Math.sin(t*.08+cloud.phase)*18};
}
export function createWeather(world,scene,air){
  const shadeLayer=new Container({label:'Cloud shadows'}),sky=new Container({label:'Clouds'});
  scene.addChildAt(shadeLayer,scene.getChildIndex(air));scene.addChild(sky);
  const clouds=[[2300,1850,1.1],[3450,2700,.9],[1400,3150,1.15],[4250,1190,1],[3300,3900,1.2],[900,1150,.85]].map(([x,y,size],i)=>{
    const sprite=new Container({label:'Drifting cloud'});sprite.scale.set(size);
    const base=new Graphics().moveTo(-172,27).bezierCurveTo(-218,19,-214,-32,-163,-38).bezierCurveTo(-159,-91,-94,-109,-49,-75).bezierCurveTo(-14,-134,79,-114,95,-58).bezierCurveTo(141,-83,193,-55,190,-20).bezierCurveTo(236,-18,233,44,184,45).lineTo(-137,45).quadraticCurveTo(-163,46,-172,27).closePath().fill(0xf8fdff);
    const light=new Graphics().moveTo(-142,-39).bezierCurveTo(-128,-82,-81,-92,-53,-67).bezierCurveTo(-21,-108,40,-101,67,-66).bezierCurveTo(21,-79,-4,-58,-33,-43).bezierCurveTo(-72,-65,-108,-59,-142,-39).fill({color:0xffffff,alpha:.25});sprite.addChild(base,light);sprite.alpha=.28;sky.addChild(sprite);
    const shadow=new Graphics();
    for(const [scale,alpha]of [[1.15,.018],[1,.025],[.84,.025]])shadow.ellipse(0,0,185*size*scale,62*size*scale).fill({color:0x324d66,alpha});
    shadeLayer.addChild(shadow);return {x,y,sprite,shadow,speed:8+i*.8,phase:i*1.7};
  });
  const gusts=Object.entries(world.zones).map(([name,zone],i)=>{
    const sprite=new Graphics({label:'Wind ribbon'}).moveTo(-88,0).bezierCurveTo(-30,-16,6,17,65,0).bezierCurveTo(97,-10,96,-34,77,-32).bezierCurveTo(60,-30,66,-15,80,-19)
      .moveTo(-60,17).quadraticCurveTo(-4,30,35,14).stroke({color:0xf1fbf5,width:1.8,cap:'round'});
    air.addChild(sprite);return {sprite,x:zone.x+(name==='plaza'?-470:0),y:zone.y+180,phase:i*.137};
  });
  return {update(time,reduced,visible){
    for(const cloud of clouds){const pose=cloudPose(cloud,time,world.width,reduced);const fade=Math.min(1,(pose.x+500)/350,(world.width+500-pose.x)/350);cloud.sprite.alpha=.28*fade;cloud.shadow.alpha=fade;cloud.sprite.position.set(pose.x,pose.y);cloud.shadow.position.set(pose.x+70,pose.y+100);cloud.sprite.visible=visible(pose.x,pose.y,350);cloud.shadow.visible=visible(pose.x+70,pose.y+100,350);}
    for(const gust of gusts){const age=(time*.075+gust.phase)%1,x=gust.x+(age-.5)*360,y=gust.y+Math.sin(time*.35+gust.phase)*18;gust.sprite.position.set(x,y);gust.sprite.alpha=Math.sin(age*Math.PI)*.24;gust.sprite.visible=!reduced&&visible(x,y,200);}
  }};
}
