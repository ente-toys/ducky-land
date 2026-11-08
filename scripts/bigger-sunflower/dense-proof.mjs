import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {render,OUT,A} from './render.mjs';
import {roadCoverage,clusterMetrics} from './dense-metrics.mjs';
import {roadArt} from './roads.mjs';
import {lanes,roadWidths} from './design.mjs';
import {communities,houses} from './communities.mjs';
import {inPoly} from '../../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(readFileSync(p)),art=read(A+'art.json'),world=read('rive/web/themes/sunflower/world.json'),old=read('scripts/bigger-sunflower/baseline/art.json'),original=read('scripts/bigger-sunflower/baseline/world.json');
const dir=OUT+'/sunflower-dense-crops';mkdirSync(dir,{recursive:true});
const before=read('scripts/bigger-sunflower/dense-baseline/metrics.json');
const expected=read('scripts/bigger-sunflower/dense-baseline/preservation.json');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
// Homes and frontage lanes are the authorized edits; community identities,
// greens, spawn points and workplaces, plus every original zone, stay fixed.
const zones=Object.fromEntries(Object.entries(world.zones).map(([id,v])=>[id,Object.fromEntries(Object.entries(v).filter(([k])=>!['homes','lane'].includes(k)))]));
const preserved={water:world.water,bridges:world.bridges,decks:art.decks,coast:world.coast,origin:world.origin,zones,harbor:read('rive/web/themes/sunflower/harbor.json')};
for(const[key,value]of Object.entries(preserved))assert.equal(hash(value),expected[key],key+' unchanged from fix pass');
const roads=await roadCoverage(roadArt(lanes,communities,houses),world);
assert.ok(roads.roadPercent<25,'roads occupy less than one quarter of new dry land');
const cameras={
 pollenpatch:{x:540,y:-320,k:.8,w:2520,h:1280},
 hayhello:{x:4940,y:-520,k:.8,w:2560,h:1360},
 whirlyseed:{x:7750,y:2150,k:.8,w:1520,h:1840},
 petalpost:{x:2570,y:5150,k:.8,w:2520,h:1280},
 seedwake:{x:-1480,y:2350,k:.8,w:1440,h:1840},
};
await render(art,OUT+'/sunflower-dense.png',{x:-2400,y:-1680,k:.13,w:1664,h:1165});
for(const c of communities)await render(art,dir+'/'+c.id+'.png',cameras[c.id]);
await render(art,dir+'/road-junction.png',{x:2400,y:-100,k:.8,w:1120,h:880});
await render(art,dir+'/lane.png',{x:8750,y:2850,k:.8,w:880,h:800});
// Compare assembled production pixels against the original heart, not a pasted overlay.
const camera={x:0,y:0,k:.25,w:2000,h:1400};
const frames=[];
for(const [id,a]of [['old',old],['dense',art]]){const path=OUT+'/sunflower-work/dense-pixel-'+id+'.png';await render(a,path,camera,true);frames.push(await sharp(path).ensureAlpha().raw().toBuffer());}
let tested=0,changed=0;
for(let y=0;y<1400;y++)for(let x=0;x<2000;x++){const j=(y*2000+x)*4,wx=x*4,wy=y*4;
 if((inPoly(wx,wy,original.coast)||original.islets.some(([cx,cy,rx,ry])=>((wx-cx)/(rx-10))**2+((wy-cy)/(ry-10))**2<1))&&frames[0][j+3]===255){tested++;if(!frames[0].subarray(j,j+4).equals(frames[1].subarray(j,j+4)))changed++;}
}
assert.equal(changed,0,'original opaque dry pixels unchanged');
let bytes=0;for(const t of art.ground.tiles){const m=await sharp(A+t.src).metadata();bytes+=m.width*m.height*4*(t.resolution??1)**2;assert.ok(m.width<=1536&&m.height<=1536);}
const result={before,after:{roads,clusters:clusterMetrics(communities)},network:{mainLoops:1,mainWidth:roadWidths[0],heartApproaches:7,shortResidentialLanes:3,porches:houses.length},preservation:{fullyOpaqueInteriorPixels:tested,changedPixels:changed,fixPassHashes:expected},ground:{tiles:art.ground.tiles.length,decodedMiB:bytes/1048576},proof:{overview:'sunflower-dense.png',communityCrops:communities.map(c=>c.id),pixelsPerUnit:.8,renderer:'Static assembly of actual production SVGs. Excludes live ducks, animation and runtime shadows.'}};
writeFileSync(OUT+'/sunflower-work/dense-proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
