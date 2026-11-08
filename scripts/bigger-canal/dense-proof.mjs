import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {render,read,OUT} from './render.mjs';

const S='scripts/bigger-canal/', art=read('public/pixi-art/themes/canal/art.json');
const baseline=read(S+'dense-baseline.json');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
for(const [file,fields] of Object.entries(baseline.preserved)) {
 const data=read(file);
 for(const [key,expected] of Object.entries(fields))assert.equal(hash(data[key]),expected,`${file}: ${key} changed`);
}
const frame={cx:4000,cy:3000,k:.105,W:1500,H:1200};
await render(art,OUT+'/canal-dense.png',frame);
const crops=[['bobbinboat',-650,1700],['petalpost',4000,-500],['pearlbutton',9050,2150],['reedwhistle',2050,6390],['lane',3900,-360],['road-junction',9200,2820]];
for(const [name,cx,cy] of crops)await render(art,OUT+`/canal-dense-${name}.png`,{cx,cy,k:.8,W:1900,H:1500});
const original=read(S+'original-art.json');
await render(original,OUT+'/canal-dense-original-proof.png',frame);
const before=await sharp(OUT+'/canal-dense-original-proof.png').ensureAlpha().raw().toBuffer();
const after=await sharp(OUT+'/canal-dense.png').ensureAlpha().raw().toBuffer();
const mask=await sharp(OUT+'/canal-preservation-mask.svg').resize(frame.W,frame.H).ensureAlpha().raw().toBuffer();
let sampled=0,changed=0;
for(let i=0;i<before.length;i+=4)if(mask[i+3]===255&&mask[i]>250){sampled++;if([0,1,2,3].some(c=>before[i+c]!==after[i+c]))changed++;}
assert.equal(changed,0,'original interior pixels changed');
const homes=art.props.filter(p=>p.id?.startsWith('comm-')&&(/-home$/.test(p.id)||/^comm-(quay|petal|pearl|reed)-[ab]$/.test(p.id)));
const district=p=>p.x>7500?'shell':p.y>5000?'reed':p.y<0?'petal':'bobbin';
function spacing(list) {
 const near=list.map(p=>Math.min(...list.filter(q=>p.id!==q.id).map(q=>Math.hypot(q.x-p.x,q.y-p.y)))).sort((a,b)=>a-b);
 return {homes:list.length,medianNearestHome:Math.round((near[Math.floor((near.length-1)/2)]+near[Math.floor(near.length/2)])/2)};
}
const density=Object.fromEntries(['bobbin','petal','shell','reed'].map(id=>[id,{before:spacing(baseline.homes.filter(p=>district(p)===id)),after:spacing(homes.filter(p=>district(p)===id))}]));
const metrics=read(S+'dense-metrics.json');
assert.ok(metrics.roadPercentAfter<20);
assert.ok(metrics.roadAreaAfter<metrics.roadAreaBefore);
for(const d of Object.values(density)){assert.equal(d.after.homes,9);assert.ok(d.after.medianNearestHome<d.before.medianNearestHome);}
const proof={renderer:'Static production SVGs at production positions, without players, dynamic GPU water or runtime contact shadows',overview:'canal-dense.png',crops:{pixelsPerWorldUnit:.8,width:1900,height:1500,names:crops.map(c=>c[0])},preservedFieldsVerified:true,originalPixels:{sampled,changed},roads:metrics,density};
fs.writeFileSync(S+'dense-proof.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
