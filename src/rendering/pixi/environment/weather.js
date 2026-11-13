import {Graphics} from 'pixi.js';
import {PALETTE} from '../../shared/palette.js';
export const windStrength=(time,reduced=false)=>reduced?0:.35+.65*(.5+.5*Math.sin(time*.38));
export function createWeather(world,air){
  const ribbon=()=>{const sprite=new Graphics({label:'Wind ribbon'}).moveTo(-88,0).bezierCurveTo(-30,-16,6,17,65,0).bezierCurveTo(97,-10,96,-34,77,-32).bezierCurveTo(60,-30,66,-15,80,-19)
      .moveTo(-60,17).quadraticCurveTo(-4,30,35,14).stroke({color:PALETTE.cream,width:1.8,cap:'round'});air.addChild(sprite);return sprite;};
  const zonesOf=w=>Object.entries(w.zones??{}).filter(([,z])=>Number.isFinite(z?.x)&&Number.isFinite(z?.y));
  let gusts=zonesOf(world).map(([name,zone],i)=>({sprite:ribbon(),x:zone.x+(name==='plaza'?-470:0),y:zone.y+180,phase:i*.137}));
  const home={gusts:gusts.map(g=>[g.x,g.y])};
  return {
  setMap(map){
    const w=map?.world ?? world;
    const zones=!map||map.home?null:zonesOf(w);
    if(!zones){gusts.forEach((g,i)=>{if(home.gusts[i]){[g.x,g.y]=home.gusts[i];g.off=false;}else{g.off=true;g.sprite.visible=false;}});return;}
    while(gusts.length<zones.length)gusts.push({sprite:ribbon(),x:0,y:0,phase:gusts.length*.137});
    gusts.slice(zones.length).forEach(g=>{g.sprite.visible=false;g.off=true;});
    zones.forEach(([name,z],i)=>Object.assign(gusts[i],{x:z.x+(name==='plaza'?-470:0),y:z.y+180,off:false}));
  },
  update(time,reduced,visible){
    for(const gust of gusts){if(gust.off){gust.sprite.visible=false;continue;}const age=(time*.075+gust.phase)%1,x=gust.x+(age-.5)*360,y=gust.y+Math.sin(time*.35+gust.phase)*18;gust.sprite.position.set(x,y);gust.sprite.alpha=Math.sin(age*Math.PI)*.24;gust.sprite.visible=!reduced&&visible(x,y,200);}
  }};
}
