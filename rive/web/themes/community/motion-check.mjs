import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sprite,Texture} from 'pixi.js';
import {updateCommunityCentre} from '../../../../public/pixi-art/themes/community/centre/animate.js';
const manifest=JSON.parse(fs.readFileSync('public/pixi-art/themes/community/art.json'));
const flame={...manifest.props.find(p=>p.id==='campfire-flame'),sprite:new Sprite(Texture.EMPTY)};
const base={...manifest.props.find(p=>p.id==='campfire'),sprite:new Sprite(Texture.EMPTY)};
flame.sprite.position.set(flame.x,flame.y);base.sprite.position.set(base.x,base.y);
base.sprite.width=base.width*base.scale;base.sprite.height=base.height*base.scale;
const baseScale=[base.sprite.scale.x,base.sprite.scale.y];
const art={id:'community',props:[flame,base]}, samples=[];
for(const t of [0,.11,.23,.51,.89]){
 updateCommunityCentre(art,t,false);samples.push({t,x:flame.sprite.scale.x,y:flame.sprite.scale.y,skew:flame.sprite.skew.x,alpha:flame.sprite.alpha});
 assert.equal(flame.sprite.x,flame.x);assert.equal(flame.sprite.y,flame.y);assert.equal(base.sprite.scale.x,baseScale[0]);assert.equal(base.sprite.scale.y,baseScale[1]);
}
assert(new Set(samples.map(s=>s.y)).size>1);
updateCommunityCentre(art,0,true);const reduced=[flame.sprite.scale.x,flame.sprite.scale.y,flame.sprite.skew.x,flame.sprite.alpha];
updateCommunityCentre(art,2,true);assert.deepEqual([flame.sprite.scale.x,flame.sprite.scale.y,flame.sprite.skew.x,flame.sprite.alpha],reduced);
assert.equal(flame.sprite.skew.x,0);assert.equal(flame.sprite.alpha,1);
// The game makes props upright after loading. The fire must remain attached through that correction.
base.sprite.scale.y/=.78;updateCommunityCentre(art,0,true);
assert.equal(flame.sprite.y,base.sprite.y+(flame.anchor.y-base.anchor.y)*base.sprite.height);
assert.equal(flame.sprite.height,base.sprite.height);
fs.writeFileSync('rive/web/themes/community/motion-validation.json',JSON.stringify({tested:'actual Pixi Sprite transforms, offline',samples,reducedMotionStable:true,hearthStable:true,anchorStable:true},null,2));
console.log('PASS: flame changes, hearth and anchor stay fixed, reduced motion is stable');
