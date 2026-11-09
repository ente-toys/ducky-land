import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
const O='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/home-review',root=process.cwd(),E=JSON.parse(fs.readFileSync('src/pixi/home-expansion.json')),before=JSON.parse(fs.readFileSync(O+'/fix/before-expansion.json')),A=JSON.parse(fs.readFileSync(O+'/placements.json')),B=JSON.parse(fs.readFileSync(O+'/fix/placements.json'));
const sacks=e=>e.props.filter(p=>p.asset==='flour-sacks').map(p=>({id:p.id,x:p.x,y:p.y,footprint:p.footprint}));
assert.deepEqual(sacks(E),sacks(before));assert.deepEqual(B.sleepers,A.sleepers);assert.equal(B.sleepers.length,40);
const original=execFileSync('git',['show','HEAD:public/pixi-art/prop-46.svg']);assert.ok(original.equals(fs.readFileSync('public/pixi-art/prop-46.svg')));
const sources=[...new Set([...B.props,...B.flats,...B.decks,...B.tiles,...B.floating].map(p=>p.src))];let issues=[];
for(const src of sources){const f=src.startsWith('/pixi-art/')?root+'/public'+src:src.startsWith('/assets/')?root+src:path.isAbsolute(src)?src:root+'/'+src;const s=fs.readFileSync(f,'utf8');if(!src.endsWith('.svg')||/<(?:image|filter|linearGradient|radialGradient)\b/i.test(s))issues.push(src);}
assert.deepEqual(issues,[]);
const audit=JSON.parse(fs.readFileSync(O+'/fix/walk-audit.json'));assert.equal(audit.overlaps,0);assert.equal(audit.deadEnds,0);assert.ok(audit.destinations.every(d=>d.reached));
const report={sackIdsPositionsFootprintsUnchanged:true,sleepersUnchanged:40,lighthouseArtUnchanged:true,svgSources:sources.length,forbiddenSvgFeatures:issues,pathOverlaps:0,deadEnds:0,sampledRoutePoints:audit.sampledRoutePoints,namedDestinations:audit.destinations.length,bridges:E.homeArches.length};
fs.writeFileSync(O+'/fix/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
