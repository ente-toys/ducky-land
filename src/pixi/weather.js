import {Container,Graphics} from 'pixi.js';
import {PALETTE} from './palette.js';
export const windStrength=(time,reduced=false)=>reduced?0:.35+.65*(.5+.5*Math.sin(time*.38));
export function cloudPose(cloud,time,width,reduced=false){
  const t=reduced?0:time;
  return {x:((cloud.x+t*cloud.speed+500)%(width+1000))-500,y:cloud.y+Math.sin(t*.08+cloud.phase)*18};
}
export function createWeather(world,scene,air){
  const shadeLayer=new Container({label:'Cloud shadows'}),sky=new Container({label:'Clouds'});
  scene.addChildAt(shadeLayer,scene.getChildIndex(air));scene.addChild(sky);
  // round 4 (critics): clouds only drift over the open sea north and south of the island, never over props; no ground shadows,
  // a rounded puff with no flat base, softer alpha
  const clouds=[[2300,230,1.1],[4400,300,.9],[900,330,.85],[3400,4150,1.2],[1300,4230,1],[5000,4120,.95]].map(([x,y,size],i)=>{
    const sprite=new Container({label:'Drifting cloud'});sprite.scale.set(size);
    const base=new Graphics().moveTo(-172,27).bezierCurveTo(-218,19,-214,-32,-163,-38).bezierCurveTo(-159,-91,-94,-109,-49,-75).bezierCurveTo(-14,-134,79,-114,95,-58).bezierCurveTo(141,-83,193,-55,190,-20).bezierCurveTo(236,-18,233,44,184,45).bezierCurveTo(160,78,102,70,80,58).bezierCurveTo(46,84,-18,82,-40,62).bezierCurveTo(-78,82,-140,76,-150,52).bezierCurveTo(-166,48,-175,40,-172,27).closePath().fill(PALETTE.cream);
    const light=new Graphics().moveTo(-142,-39).bezierCurveTo(-128,-82,-81,-92,-53,-67).bezierCurveTo(-21,-108,40,-101,67,-66).bezierCurveTo(21,-79,-4,-58,-33,-43).bezierCurveTo(-72,-65,-108,-59,-142,-39).fill({color:PALETTE.cream,alpha:.25});sprite.addChild(base,light);sprite.alpha=.2;sky.addChild(sprite);
    const shadow=new Graphics();
    shadow.visible=false;   // round 4: no cloud shadows on the ground
    shadeLayer.addChild(shadow);return {x,y,sprite,shadow,speed:8+i*.8,phase:i*1.7};
  });
  const ribbon=()=>{const sprite=new Graphics({label:'Wind ribbon'}).moveTo(-88,0).bezierCurveTo(-30,-16,6,17,65,0).bezierCurveTo(97,-10,96,-34,77,-32).bezierCurveTo(60,-30,66,-15,80,-19)
      .moveTo(-60,17).quadraticCurveTo(-4,30,35,14).stroke({color:PALETTE.cream,width:1.8,cap:'round'});air.addChild(sprite);return sprite;};
  const zonesOf=w=>Object.entries(w.zones??{}).filter(([,z])=>Number.isFinite(z?.x)&&Number.isFinite(z?.y));
  let gusts=zonesOf(world).map(([name,zone],i)=>({sprite:ribbon(),x:zone.x+(name==='plaza'?-470:0),y:zone.y+180,phase:i*.137}));
  let width=world.width;
  const home={width:world.width,height:world.height,clouds:clouds.map(c=>c.y),gusts:gusts.map(g=>[g.x,g.y])};
  return {
  // boss 6 Nov: a themed island has its own size and places: the clouds drift over ITS north and south sea, and the wind
  // ribbons blow over its own zones. Home is restored exactly (setMap(null)).
  setMap(map){
    const w=map?.world ?? world, h=map?.height ?? world.height;
    width=map?.width ?? world.width;
    // A themed island with an authored coast keeps its clouds out over the sea beyond that coast, never over the land.
    const coast=!map||map.home?null:w?.coast,ys=coast?.length?coast.map(p=>p[1]):null,top=ys&&Math.min(...ys),bottom=ys&&Math.max(...ys);
    clouds.forEach((c,i)=>{const y=home.clouds[i],north=y<home.height/2;
      c.y=!map||map.home?y:ys?(north?top-260+(y-230)*.6:bottom+260+(y-4120)*.6):north?y:h-(home.height-y);});
    const zones=!map||map.home?null:zonesOf(w);
    if(!zones){gusts.forEach((g,i)=>{if(home.gusts[i]){[g.x,g.y]=home.gusts[i];g.off=false;}else{g.off=true;g.sprite.visible=false;}});return;}
    while(gusts.length<zones.length)gusts.push({sprite:ribbon(),x:0,y:0,phase:gusts.length*.137});
    gusts.slice(zones.length).forEach(g=>{g.sprite.visible=false;g.off=true;});
    zones.forEach(([name,z],i)=>Object.assign(gusts[i],{x:z.x+(name==='plaza'?-470:0),y:z.y+180,off:false}));
  },
  update(time,reduced,visible){
    for(const cloud of clouds){const pose=cloudPose(cloud,time,width,reduced);const fade=Math.min(1,(pose.x+500)/350,(width+500-pose.x)/350);cloud.sprite.alpha=.2*fade;cloud.shadow.alpha=0;cloud.sprite.position.set(pose.x,pose.y);cloud.shadow.position.set(pose.x+70,pose.y+100);cloud.sprite.visible=visible(pose.x,pose.y,350);cloud.shadow.visible=false;}
    for(const gust of gusts){if(gust.off){gust.sprite.visible=false;continue;}const age=(time*.075+gust.phase)%1,x=gust.x+(age-.5)*360,y=gust.y+Math.sin(time*.35+gust.phase)*18;gust.sprite.position.set(x,y);gust.sprite.alpha=Math.sin(age*Math.PI)*.24;gust.sprite.visible=!reduced&&visible(x,y,200);}
  }};
}
