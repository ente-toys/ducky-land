import {Sprite} from 'pixi.js';
import {createPlantContacts, foliageColour, PLANT_SWAY, LEAF_LIFE, LEAF_CAP} from './plant-contact.js';
import {createPlantSnow} from './plant-snow.js';

export const LEAF_TEXTURE = '/pixi-art/fx/contact-leaf.svg';
const EMPTY=[];

export function createPlantReactions(parent, texture,options={}) {
  const maps=new Map(), colours=new Map(), leaves=[];
  let current=null, reduced=false, shown=true, snow=null;
  for (let i=0;i<LEAF_CAP;i++) {
    const sprite=new Sprite(texture); sprite.anchor.set(.5); sprite.visible=false;
    parent.addChild(sprite);
    leaves.push({sprite,at:-Infinity,x:0,y:0,fall:0,direction:1,phase:0});
  }
  function bump(plant,time) {
    if (plant.snow) {snow?.bump(plant,time);return;}
    if (plant.kind!=='tree') return;
    const leaf=leaves.find(l=>time-l.at>=LEAF_LIFE);
    if (!leaf) return; // Full pool: keep the sway, never allocate or replace a visible leaf.
    const p=plant.prop, height=p.height*(p.scale??1);
    leaf.at=time; leaf.direction=plant.direction; leaf.phase=(p.x+p.y)*.017;
    leaf.x=p.x; leaf.y=p.y-height*.66; leaf.fall=height*.62;
    const colour=plant.colour??0x63ae45, tint=p.sprite.tint??0xffffff;
    leaf.sprite.tint=(Math.round((colour>>16)*(tint>>16)/255)<<16) |
      (Math.round(((colour>>8)&255)*((tint>>8)&255)/255)<<8) | Math.round((colour&255)*(tint&255)/255);
    leaf.sprite.scale.set(Math.min(1.2,Math.max(.65,height/420)));
  }
  function restore(map) {
    for (const plant of map?.plants??EMPTY) {
      const s=plant.prop.sprite;
      if (s.destroyed || !plant.sx) continue;
      s.scale.x/=plant.sx; s.scale.y/=plant.sy;
      // The next frame's ambient pass overwrites skew. Clear only our contribution on handoff.
      s.skew.x-=plant.skew;
      plant.sx=plant.sy=1; plant.skew=0;
    }
  }
  return {
    register(id,props,obstacles,base='') {
      const winter=id==='snow';
      const map=createPlantContacts(props,obstacles,bump,{snow:winter}); maps.set(id,map);
      map.snow=winter;
      if (winter && !snow) snow=createPlantSnow(parent,options.snow);
      for (const plant of map.plants) {
        if (winter) {snow.prepare(plant,base);continue;}
        if (plant.kind!=='tree') continue;
        const src=plant.prop.src, url=/^(\/|https?:|data:)/.test(src)?src:base+src;
        let colour=colours.get(url);
        if (!colour) {
          colour=fetch(url).then(r=>r.ok?r.text():'').then(svg=>foliageColour(svg)).catch(()=>0x63ae45);
          colours.set(url,colour);
        }
        colour.then(value=>{plant.colour=value;});
      }
    },
    begin(id,time,reduce=false,visible=true) {
      const map=maps.get(id);
      // begin runs before the engine's ambient sway pass. Clear our previous
      // contribution here so repeated contacts and handoffs cannot accumulate skew.
      restore(current);
      if (map!==current) {
        current=map;
        snow?.reset();
        for (const l of leaves) {l.at=-Infinity; l.sprite.visible=false;}
      }
      reduced=reduce; shown=visible;
      current?.begin(time,reduce||!visible);
    },
    track(actor,x,y,onLand=true) {current?.track(actor,x,y,onLand);},
    update(time) {
      for (const plant of current?.plants??EMPTY) {
        const s=plant.prop.sprite;
        // Undo last frame's multipliers, so deferred textures and upright correction stay intact.
        if (plant.sx) {s.scale.x/=plant.sx; s.scale.y/=plant.sy;}
        plant.sx=plant.sy=1; plant.skew=0;
        if (reduced || !shown) plant.lastAt=-Infinity;
        const u=(time-plant.lastAt)/PLANT_SWAY;
        if (reduced || !shown || !s.visible || u<0 || u>=1) continue;
        const decay=(1-u)**3, wave=Math.sin(u*Math.PI*3.5)*decay;
        plant.sx=1+.035*Math.sin(Math.PI*u)*decay;
        plant.sy=1-.045*Math.sin(Math.PI*u)*decay;
        plant.skew=plant.direction*.035*wave;
        // Shear/squash about the ground anchor. The trunk base never rotates or translates.
        s.scale.x*=plant.sx; s.scale.y*=plant.sy; s.skew.x+=plant.skew;
      }
      for (const l of leaves) {
        const u=(time-l.at)/LEAF_LIFE, s=l.sprite;
        s.visible=shown && !reduced && u>=0 && u<1;
        if (reduced) l.at=-Infinity;
        if (!s.visible) continue;
        const flutter=Math.sin(u*Math.PI*4+l.phase)-Math.sin(l.phase);
        s.position.set(l.x+l.direction*48*u+flutter*9,l.y+l.fall*u+Math.sin(u*Math.PI*3)*4);
        s.rotation=l.direction*u*1.8+flutter*.18;
        s.alpha=Math.min(1,(1-u)*4);
      }
      snow?.update(time,shown&&current?.snow,reduced);
    },
    unregister(id) {const map=maps.get(id); restore(map); if(map?.snow){snow?.remove(map.plants);snow?.destroy();snow=null;} maps.delete(id); if (current===map) {current=null;snow?.reset();}},
    destroy() {for (const map of maps.values()) restore(map); maps.clear(); colours.clear();snow?.destroy(); for (const l of leaves) l.sprite.destroy();},
  };
}
