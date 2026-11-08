import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {render,read} from './render.mjs';
import {inPoly,inShape,geometry} from '../../rive/web/island-geometry.mjs';
import {mapFor} from '../../src/pixi/island-maps.js';

const out='../concepts/themes/world-map/bigger',A='public/pixi-art/themes/pink/';
mkdirSync(out+'/pink-dense-crops',{recursive:true});
const art=read(A+'art.json'),layout=read('scripts/bigger-pink/layout.json');
const before=read('scripts/bigger-pink/dense-before-layout.json'),boats=read('rive/web/themes/pink/harbor.json').boats;
await render(art,[-2600,-1900,13200,9800],.15,out+'/pink-dense.png',{boats});
for(const [name,view] of Object.entries({
 ribbonwick:[-1100,-650,3600,2700],melody:[4700,-850,3400,2550],
 quay:[7640,750,2400,3000],petalpatch:[-1800,1500,2600,2400],tutu:[2600,5000,3200,2400]
}))await render(art,view,.55,out+'/pink-dense-crops/'+name+'.png',{boats});

const map=mapFor('pink'),nav=map.nav(),raw=geometry({...map.walk,bridges:[]});
const validation={preserved:{},households:[],crossings:[],roadArea:layout.roadArt.densityMetrics};
for(const key of ['coast','places','water','bridges','decks','riverCrossings','bridgeAudit','streams']){
 assert.deepEqual(layout[key],before[key],key);validation.preserved[key]=true;
}
for(const h of layout.props.filter(p=>p.household)){
 const gate=[h.x,h.y+220],open=nav.walkable(...gate),reachable=!!nav.route(map.spawn.x,map.spawn.y,...gate).length;
 assert.ok(open&&reachable,h.id+' open, connected gate');
 validation.households.push({id:h.id,zone:h.zone,gate,open,reachable});
}
for(const p of layout.props)assert.ok(!layout.water.some(w=>inShape(p.x,p.y,w)),p.id+' dry');
for(const c of layout.riverCrossings){
 const wet=layout.water.some(w=>inShape(...c.mid,w)),deck=nav.walkable(...c.mid),blockedWithoutDeck=!raw.walkable(...c.mid);
 assert.ok(wet&&deck&&blockedWithoutDeck,c.name);
 validation.crossings.push({name:c.name,wet,deck,blockedWithoutDeck});
}
// Compare production ground layers at the same resolution and protected mask.
const k=.25,w=2000,h=1450,oldWorld=read('scripts/bigger-pink/original-world.json');
const original=await sharp(A+'ground.svg').resize(w,h).ensureAlpha().raw().toBuffer();
const outer=await sharp(A+'expansion/outer-ground.svg').resize(3300,2450).extract({left:650,top:475,width:w,height:h}).png().toBuffer();
const inner=await sharp(A+'expansion/original-ground.svg').resize(w,h).png().toBuffer();
const built=await sharp(outer).composite([{input:inner}]).ensureAlpha().raw().toBuffer();
let protectedPixels=0,changed=0;
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const i=(y*w+x)*4;
 const protectedLand=inPoly(x/k,y/k,oldWorld.coast)||oldWorld.islets.some(([cx,cy,rx,ry])=>((x/k-cx)/rx)**2+((y/k-cy)/ry)**2<1);
 if(original[i+3]!==255||!protectedLand)continue;
 protectedPixels++;if(!original.subarray(i,i+4).equals(built.subarray(i,i+4)))changed++;
}
validation.originalGround={scale:k,protectedPixels,changed};
assert.equal(changed,0,'original dry ground pixel preservation');
writeFileSync(out+'/pink-dense-validation.json',JSON.stringify(validation,null,2)+'\n');
console.log(JSON.stringify({households:validation.households.length,crossings:validation.crossings.length,originalGround:validation.originalGround,roads:{before:validation.roadArea.before,after:validation.roadArea.after}},null,2));
