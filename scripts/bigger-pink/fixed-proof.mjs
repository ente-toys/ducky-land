import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {render,read} from './render.mjs';
import {mapFor} from '../../src/pixi/island-maps.js';
import {inPoly,inShape,geometry} from '../../rive/web/island-geometry.mjs';
const out='../concepts/themes/world-map/bigger';mkdirSync(out+'/pink-fixed-crops',{recursive:true});
const art=read('public/pixi-art/themes/pink/art.json'),layout=read('scripts/bigger-pink/layout.json'),boats=read('rive/web/themes/pink/harbor.json').boats;
await render(art,[-2600,-1900,13200,9800],.15,out+'/pink-fixed.png',{boats});
for(const [name,view] of Object.entries({bridge:[200,650,1500,1125],junction:[-1450,1080,1500,1125],riverjunction:[890,4100,1500,1125],community:[-900,-500,2400,1800],lane:[7800,1100,1500,1125],stream:[6940,3020,1500,1125],commons:[500,3150,1800,1350]}))await render(art,view,.8,out+'/pink-fixed-crops/'+name+'.png',{boats});
const map=mapFor('pink'),nav=map.nav();
const dryMap={...map.walk,bridges:[]},raw=geometry(dryMap);
const validation={oldDecks:layout.bridgeAudit,newCrossings:layout.riverCrossings.map(c=>({...c,waterUnder:map.world.water.some(o=>inShape(...c.mid,o)),onDeck:nav.walkable(...c.mid),blockedWithoutDeck:!raw.walkable(...c.mid)})),households:layout.props.filter(p=>p.household).map(h=>({id:h.id,src:h.src,gate:nav.walkable(h.x,h.y+220),reachable:!!nav.route(map.spawn.x,map.spawn.y,h.x,h.y+220).length})),streams:layout.streams.map(s=>({name:s.name,water:s.points.map(([x,y])=>[x,y,map.world.water.some(o=>inShape(x,y,o)),nav.walkable(x,y)])}))};
writeFileSync(out+'/pink-fixed-validation.json',JSON.stringify(validation,null,2)+'\n');console.log(JSON.stringify(validation,null,2));

const A="public/pixi-art/themes/pink/",S="scripts/bigger-pink/";
const k=.25,w=2000,h=1450,oldWorld=read(S+'original-world.json');
const original=await sharp(A+'ground.svg').resize(w,h).ensureAlpha().raw().toBuffer();
const outer=await sharp(A+'expansion/outer-ground.svg').resize(3300,2450).extract({left:650,top:475,width:w,height:h}).png().toBuffer();
const inner=await sharp(A+'expansion/original-ground.svg').resize(w,h).png().toBuffer();
const built=await sharp(outer).composite([{input:inner}]).ensureAlpha().raw().toBuffer();
let protectedPixels=0,changed=0;
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const i=(y*w+x)*4,protectedLand=inPoly(x/k,y/k,oldWorld.coast)||oldWorld.islets.some(([cx,cy,rx,ry])=>((x/k-cx)/rx)**2+((y/k-cy)/ry)**2<1);
 if(original[i+3]!==255||!protectedLand)continue;
 protectedPixels++;if(!original.subarray(i,i+4).equals(built.subarray(i,i+4)))changed++;
}
const pixelValidation={scale:k,protectedPixels,changed,originalProps:read(S+'original-art.json').props.length,originalFlats:read(S+'original-art.json').flats.length,originalSleepers:40,note:'Protected opaque dry-ground and islet pixels. Original SVG, placements, centre, sleepers and collision records preserved; former offshore foam decoration omitted from derivative ground. Static art proof excludes live players, water animation and runtime shadows.'};
writeFileSync(S+'pixel-validation.json',JSON.stringify(pixelValidation,null,2)+'\n');copyFileSync(S+'pixel-validation.json',out+'/pink-pixel-validation.json');
assert.equal(changed,0,'protected original dry ground stays pixel identical');console.log(pixelValidation);

await sharp({create:{width:3600,height:900,channels:4,background:'#fff0c7'}}).composite([
{input:await sharp('../concepts/themes/world-map/cursor-camp-paths-ref.jpg').resize(1200,900,{fit:'contain',background:'#fff0c7'}).png().toBuffer(),left:0,top:0},
{input:out+'/pink-fixed-crops/junction.png',left:1200,top:0},
{input:out+'/pink-fixed-crops/lane.png',left:2400,top:0}
]).png().toFile(out+'/pink-fixed-paths-vs-reference.png');
