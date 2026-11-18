// A racer's outfit (cap, shades, accessory) drawn on the racer sprite: the wardrobe's own three-quarter art from
// the duck rig, lined up on the racer's eyes. A cap hides the tuft, as on the island, so capped racers use the
// tuft-less drawing.
import {Assets,Container,Sprite} from 'pixi.js';
import {ART_TEXTURE} from '../../rendering/pixi/art/art-texture.js';
import {OUTFIT_OPTIONS} from '../../gameplay/outfits.js';

const MANIFEST='/pixi-duck/manifest.json',VIEW=45,SLOTS=['acc','shades','cap'];
const TUFT_CAPS=new Set([3,12,13]);   // caps the rig draws with the tuft showing
// the racer drawings (512 wide): where the tube meets the snow, and the two eyes
export const RIDERS={
  tuft:{art:'rider',ground:.86,eyes:[[248.2,157],[313,156.5]]},
  bald:{art:'rider-bald',ground:.848,eyes:[[246.8,132.8],[312,132.3]]},
};
// neck pieces sit higher and narrower on the shorter seated body
const NECK={dy:-30,squeeze:.85};

let wardrobe;
export const loadWardrobe=()=>wardrobe??=fetch(MANIFEST).then(r=>r.json()).then(m=>({entries:m.wardrobe,view:m.views.find(v=>v.angle===VIEW)}));

// the wardrobe entry the rig would draw for this slot and index (unsupported indices fold onto supported ones)
function entryFor(entries,slot,index){
  if(!index)return null;
  const all=entries.filter(e=>e.slot===slot),hit=all.find(e=>e.index===Number(index));
  if(!hit||OUTFIT_OPTIONS[slot]?.includes(hit.index))return hit??null;
  const kept=all.filter(e=>OUTFIT_OPTIONS[slot].includes(e.index));
  return kept[hit.index%kept.length]??null;
}

export function riderFor(outfit,entries){
  const cap=entryFor(entries,'cap',outfit?.cap);
  return cap&&!TUFT_CAPS.has(cap.sourceNumber)?RIDERS.bald:RIDERS.tuft;
}

// the garments as sprites in the racer drawing's own pixels
export async function dressRider(outfit,rider,{entries,view}){
  const layer=new Container({label:'Outfit'});
  if(!outfit)return layer;
  const [[ax,ay],[bx,by]]=view.attachments.eyes.slice().sort((p,q)=>p[0]-q[0]),[[cx,cy],[dx,dy]]=rider.eyes;
  const scale=Math.hypot(dx-cx,dy-cy)/Math.hypot(bx-ax,by-ay),[gx,gy]=view.ground;
  const at=(x,y)=>[(cx+dx)/2+(x-(ax+bx)/2)*scale,(cy+dy)/2+(y-(ay+by)/2)*scale];
  for(const slot of SLOTS){
    const entry=entryFor(entries,slot,outfit[slot]);
    for(const frame of entry?.frames[String(VIEW)]??[]){
      if(!frame.visible)continue;
      const texture=await Assets.load({src:frame.url,data:ART_TEXTURE}),sprite=new Sprite(texture);
      let [x,y]=at(frame.rect[0]+gx,frame.rect[1]+gy),sx=scale;
      if(frame.attachment==='neck'){const mid=256;x=mid+(x-mid)*NECK.squeeze;y+=NECK.dy;sx*=NECK.squeeze;}
      sprite.position.set(x,y);sprite.scale.set(sx*frame.rect[2]/texture.width,scale*frame.rect[3]/texture.height);
      layer.addChild(sprite);
    }
  }
  return layer;
}
