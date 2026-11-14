import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import baseline from './fixtures/home-moves-main.json' with {type:'json'};
import previousReview from './fixtures/home-moves-review.json' with {type:'json'};
import restored from './fixtures/home-restored.json' with {type:'json'};
const review=[...new Map([...previousReview,...restored].map(r=>[r.id,r])).values()];
import expansion from '../src/world/home/home-expansion.json' with {type:'json'};
import {makeAudit,decorative} from '../scripts/home-moves/audit.mjs';
const b=await build({entryPoints:['src/world/home/placements.js'],bundle:true,platform:'node',format:'esm',write:false});
const P=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const props=P.createPlacements(),original=new Map(baseline.props.map(p=>[String(p.id),p])),byId=new Map(props.map(p=>[String(p.id),p]));
const world=P.walkWorld(P.trimWorld(JSON.parse(readFileSync('assets/world/world.json'))),props);
const drawings=[...props,...P.HOME_DECKS.map(p=>({...p,id:p.id??'fishing-deck',scale:1,anchor:{x:0,y:0}}))],allById=new Map(drawings.map(p=>[String(p.id),p]));
const audit=await makeAudit([...baseline.props,...baseline.decks],expansion,world,1,baseline.sourceSvg,baseline.surface);

test('every resolved move is reviewed and each removed prop is absent from placements, overrides and outlines',()=>{
 const rows=new Map(review.map(r=>[r.id,r]));
 for(const id of baseline.moved)assert.ok(rows.has(id),'round 7 move '+id+' reviewed');
 for(const p of props){const before=original.get(String(p.id));if(before&&(before.x!==p.x||before.y!==p.y))assert.ok(rows.has(String(p.id)),'final move '+p.id+' reviewed');}
 for(const id of baseline.round7Ids){const row=rows.get(id);assert.equal(byId.has(id),row?.verdict!=='REMOVED',id+' retained unless explicitly removed');}
 const masks=JSON.parse(readFileSync('src/world/home/front-body-silhouettes.json'));
 for(const row of review){const p=allById.get(row.id);if(row.verdict==='REMOVED'){
  assert.equal(p,undefined,row.id);assert.equal(expansion.reviewProps[row.id],undefined,row.id+' override removed');assert.equal(masks[row.id],undefined,row.id+' outline removed');
 }else {assert.ok(p,row.id);assert.deepEqual([p.x,p.y],row.final,row.id+' reviewed position');}}
});

test('no reviewed prop increases opaque drawing overlap by more than 2% of the smaller drawing versus main',async()=>{
 const violations=[];
 for(const row of review){const p=allById.get(row.id);if(p)for(const hit of await audit.excess(p,drawings))violations.push({prop:row.id,...hit});}
 assert.deepEqual(violations,[]);
});

test('reviewed props retain original ground and restored nudges stand on grass',()=>{
 const violations=[];for(const row of review.filter(r=>r.layer!=='deck')){const p=byId.get(row.id),before=original.get(row.id);if(p&&audit.ground(p)!==(row.verdict==='RESTORED-NUDGED'?'grass':audit.ground(before)))violations.push({id:row.id,main:audit.ground(before),final:audit.ground(p)});}
 assert.deepEqual(violations,[]);
});

// Round 9 places nudged anchors on grass. Canopies may overhang adjacent
// surfaces; older retained round-8 moves keep their original projection checks.
test('previous retained decorative moves keep their water and paving coverage',async()=>{
 const failures=[];for(const row of review.filter(r=>r.layer!=='deck')){const p=byId.get(row.id),b=original.get(row.id);if(!p||!decorative(p)||p.x===b.x&&p.y===b.y)continue;const before=await audit.projectedGround(b),after=await audit.projectedGround(p);if(!restored.some(r=>r.id===row.id)&&(after.water>before.water+1e-6||after.paving>before.paving+1e-6))failures.push({id:row.id,before,after});}
 assert.deepEqual(failures,[]);
});

test('every main prop is present except the explicit approved removals, with no duplicate drawings',()=>{
 const approved=new Set(['bigger-community-514','bigger-community-517','bigger-community-518','bigger-community-528','bigger-community-538','bigger-community-539','bigger-community-540','bigger-community-541','hamlet-butterbill-square-west-bench','hamlet-butterbill-square-east-bench','hamlet-lanternleaf-garden-bed','hamlet-lanternleaf-garden-rear-fence','hamlet-lanternleaf-tomatoes','hamlet-lanternleaf-cabbage-left','hamlet-lanternleaf-cabbage-right','hamlet-lanternleaf-carrots','hamlet-lanternleaf-garden-front-fence','hamlet-clovercrust-mill','hamlet-clovercrust-reading-bench','hamlet-reedwhistle-cottage-netmaker','home-farm-enclosure','home-windmill-sails','home-beach-spare-lounger','review-seedshare-seat']);
 assert.equal(byId.size,props.length,'every resolved id occurs once');
 for(const p of baseline.props)assert.equal(byId.has(String(p.id)),!approved.has(String(p.id)),String(p.id));
 assert.equal(props.length,baseline.props.length-approved.size);
 for(const r of restored.filter(r=>!r.adjustment)){
  const p=byId.get(r.id),b=original.get(r.id),d=Math.hypot(p.x-b.x,p.y-b.y);
  assert.ok(d<=250,r.id+' remains within its main neighbourhood');
  assert.equal(r.verdict,d===0?'RESTORED-EXACT':'RESTORED-NUDGED');
 }
});
