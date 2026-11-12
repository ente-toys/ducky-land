import {Assets,Container,Graphics,Sprite} from 'pixi.js';
import {ART_TEXTURE} from './art-texture.js';

export const SNOW_CLUMP_CAP=80,SNOW_PILE_CAP=10,SNOW_SHED_LIFE=1.25,SNOW_REFILL=4.6;
export function thinSnowSVG(svg,colour='#448238') {
  const snow=/#(?:fffdf4|fffdf5|fffaf0|ffffff|fff|f7f4ed|f9f6ee)\b/gi;
  const pieces=[];
  const strip=svg.replace(/<g\b[^>]*>[\s\S]*?<\/g>/gi,group=>{
    const opening=group.slice(0,group.indexOf('>')+1);
    if (!/fill=["']#(?:fffdf4|fffdf5|fffaf0|ffffff|fff|f7f4ed|f9f6ee)["']/i.test(opening)) return group;
    pieces.push(group);return '';
  });
  for (const tag of strip.matchAll(/<(?:path|ellipse|polygon)\b[^>]*\/?\s*>/gi))
    if (/fill=["']#(?:fffdf4|fffdf5|fffaf0|ffffff|fff|f7f4ed|f9f6ee)["']/i.test(tag[0])) pieces.push(tag[0]);
  if (!pieces.length) return null;
  const open=svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!open) return null;
  const cap=pieces.join('');
  return `${open}<defs><filter id="shed-inset" x="-20%" y="-20%" width="140%" height="140%"><feMorphology operator="erode" radius="5"/></filter></defs>${cap.replace(snow,colour)}<g filter="url(#shed-inset)">${cap}</g></svg>`;
}

export function createPlantSnow(parent,{load=src=>Assets.load({src,data:ART_TEXTURE}),unload=src=>Assets.unload(src)}={}) {
  const root=new Container({label:'Tree snow clumps, flakes and piles'}),flakes=[],piles=[],caps=new Set(),sources=new Map();
  root.upright=true;root.eventMode='none';
  parent.addChild(root);
  let destroyed=false;
  for (let i=0;i<SNOW_CLUMP_CAP;i++) {
    const clump=i%3===0,g=new Graphics({label:clump?'Shed snow clump':'Shed snow flake'});
    if (clump) g.ellipse(0,0,5.5,3.8).fill(0xfffdf4).ellipse(-1,-1,3,2).fill(0xffffff);
    else g.moveTo(-2.5,0).lineTo(2.5,0).moveTo(0,-2.5).lineTo(0,2.5).stroke({color:0xe2f0f5,width:1.8});
    g.visible=false;root.addChild(g);flakes.push({g,at:-Infinity});
  }
  for (let i=0;i<SNOW_PILE_CAP;i++) {
    const g=new Graphics({label:'Soft snow pile at trunk'});
    g.ellipse(0,0,29,8).fill({color:0xc9e2e9,alpha:.45}).ellipse(0,-3,25,7).fill(0xfffdf4)
      .ellipse(-11,-5,12,5).fill(0xffffff).ellipse(10,-4,13,5).fill(0xffffff);
    g.visible=false;root.addChildAt(g,0);piles.push({g,at:-Infinity});
  }
  function prepare(plant,base) {
    const p=plant.prop,url=/^(\/|https?:|data:)/.test(p.src)?p.src:base+p.src;
    let ready=sources.get(url);
    if (!ready) {
      ready=fetch(url).then(r=>r.ok?r.text():'').then(svg=>{
        const thin=thinSnowSVG(svg);if (!thin || destroyed) return null;
        const src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(thin)}`;
        const entry={src,texture:null};ready.entry=entry;
        return load(src).then(texture=>{entry.texture=texture;return texture;});
      }).catch(()=>null);
      sources.set(url,ready);
    }
    plant.snowTexture=ready;
  }
  function cap(plant,time) {
    const p=plant.prop,s=p.sprite;
    if (!plant.snowCap && plant.snowTexture) plant.snowTexture.then(texture=>{
      if (!texture || destroyed || s.destroyed || plant.snowRemoved || plant.snowCap) return;
      const film=new Sprite(texture);film.label='Thinned tree snow cap';
      const anchor=p.anchor??{x:.5,y:1};film.anchor.set(anchor.x,anchor.y);
      film.width=s instanceof Sprite?s.texture.orig.width:p.width;
      film.height=s instanceof Sprite?s.texture.orig.height:p.height;
      film.alpha=0;s.addChild(film);plant.snowCap=film;caps.add(plant);
    });
    plant.snowAt=time;
  }
  return {
    prepare,
    bump(plant,time) {
      const p=plant.prop,h=p.height*(p.scale??1),w=p.width*(p.scale??1);
      cap(plant,time);
      const pile=piles.find(p=>time-p.at>=SNOW_REFILL);
      if (pile) {pile.at=time;pile.g.position.set(p.x,p.y-2);pile.g.scale.set(Math.min(1.5,Math.max(.55,w/210)));}
      let index=0;
      for (const f of flakes) {
        if (time-f.at<SNOW_SHED_LIFE) continue;
        const n=index++,phase=n*2.399+(p.x+p.y)*.01;
        f.at=time;f.x=p.x+Math.sin(phase)*w*.32;
        f.y=p.y-h*(.45+(n%4)*.12);f.ground=p.y-3;
        f.vx=plant.direction*(18+n%5*10)+Math.sin(phase)*28;
        f.vy=10+n%3*12;f.phase=phase;
        if (index===10) break;
      }
    },
    update(time,shown,reduced) {
      root.visible=shown;
      for (const f of flakes) {
        const age=time-f.at;f.g.visible=shown&&!reduced&&age>=0&&age<SNOW_SHED_LIFE;
        if (reduced) f.at=-Infinity;
        if (!f.g.visible) continue;
        f.g.position.set(f.x+f.vx*age+Math.sin(age*8+f.phase)*4,Math.min(f.ground,f.y+f.vy*age+115*age*age));
        f.g.rotation=age*.7;f.g.alpha=Math.min(1,(SNOW_SHED_LIFE-age)*3);
      }
      for (const p of piles) {
        const age=time-p.at;p.g.visible=shown&&age>=0&&age<SNOW_REFILL;
        p.g.alpha=Math.min(1,Math.max(0,age*5),Math.max(0,(SNOW_REFILL-age)/1.8));
      }
      for (const plant of caps) {
        const age=time-plant.snowAt;
        plant.snowCap.alpha=shown&&!reduced?Math.max(0,Math.min(1,age/.09,(SNOW_REFILL-age)/2)):0;
      }
    },
    reset() {
      for (const f of flakes) {f.at=-Infinity;f.g.visible=false;}
      for (const p of piles) {p.at=-Infinity;p.g.visible=false;}
      for (const plant of caps) {plant.snowAt=-Infinity;plant.snowCap.alpha=0;}
    },
    remove(plants) {
      for (const plant of plants) {plant.snowRemoved=true;plant.snowCap?.destroy();caps.delete(plant);}
    },
    destroy() {
      destroyed=true;
      for (const plant of caps) plant.snowCap.destroy();caps.clear();
      for (const promise of sources.values()) promise.finally(()=>{if (promise.entry) unload(promise.entry.src);});
      sources.clear();root.destroy({children:true});
    },
  };
}
