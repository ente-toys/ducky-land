import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry,inShape} from '../../rive/web/island-geometry.mjs';
import {checkTheme} from '../theme-index.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/canal/',D='rive/web/themes/canal/';
const world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json'),art=read(A+'art.json'),old=read('scripts/bigger-canal/original-art.json');
const original=read('scripts/bigger-canal/original-world.json'),oldWalk=read('scripts/bigger-canal/original-walk.json');
const ready=checkTheme('canal');assert.equal(ready.ready,true,ready.problems.join('\n'));
const map=makeMap('canal',{world,walk,harbor,sleepers:ready.sleepers}),nav=map.nav();
assert.deepEqual(art.props.slice(0,old.props.length),old.props);assert.deepEqual(art.flats,old.flats);assert.deepEqual(art.floating,old.floating);assert.deepEqual(art.decks.slice(0,old.decks.length),old.decks);assert.deepEqual(world.sleepSpots,original.sleepSpots);assert.deepEqual(world.centrePlacement,original.centrePlacement);
const G=20,X=world.origin.x,Y=world.origin.y,W=Math.ceil(world.width/G),H=Math.ceil(world.height/G);const seen=new Uint8Array(W*H),ok=new Uint8Array(W*H);
const index=(x,y)=>Math.round((y-Y)/G)*W+Math.round((x-X)/G);
for(let r=0;r<H;r++)for(let c=0;c<W;c++)ok[r*W+c]=nav.walkable(X+c*G,Y+r*G)?1:0;
const start=index(map.spawn.x,map.spawn.y),q=[start];seen[start]=1;for(let k=0;k<q.length;k++){const i=q[k],r=Math.floor(i/W),c=i%W;for(const [dr,dc]of [[1,0],[-1,0],[0,1],[0,-1]]){const rr=r+dr,cc=c+dc,j=rr*W+cc;if(rr>=0&&rr<H&&cc>=0&&cc<W&&ok[j]&&!seen[j]){seen[j]=1;q.push(j);}}}
const reached=(x,y)=>{for(let dy=-20;dy<=20;dy+=G)for(let dx=-20;dx<=20;dx+=G)if(seen[index(x+dx,y+dy)])return true;return false;};const fails=[],checks=[];
function want(name,p){const route=nav.route(map.spawn.x,map.spawn.y,...p);const pass=nav.walkable(...p)&&reached(...p)&&route.length>0&&Math.hypot(route.at(-1)[0]-p[0],route.at(-1)[1]-p[1])<2;checks.push({name,point:p,pass,route:route.length});if(!pass)fails.push(name+' '+JSON.stringify(p));}
for(const [id,z]of Object.entries(world.zones))want('zone '+id,z.spawn);
for(const [i,b]of world.walkways.entries())want('original deck '+i,b.b);
want('harbor',[map.HARBOR.land.x,map.HARBOR.land.y]);
for(const p of art.props.slice(old.props.length)){
 if(/home$|loft$|house$|hall$|shed$/.test(p.id)||/^comm-(quay|petal|pearl|reed)-[ab]$/.test(p.id))want('frontage '+p.id,[p.x,p.y+100]);
 if(!/reeds/.test(p.name)&&(!map.landAt(p.x,p.y)||world.water.some(o=>inShape(p.x,p.y,o))))fails.push('prop off dry land '+p.id+' '+p.x+','+p.y);
}
for(const b of map.boatSpots())assert.ok(map.shoreFor(b.x,b.y,260),'boat has boardable shore');
// Original coastal dry interiors remain walkable exactly as before. Rivers never make water walkable away from a deck.
const before=geometry(oldWalk),after=geometry(map.baseWalk);let originalSamples=0,changed=0;
for(let y=700;y<5300;y+=23)for(let x=600;x<7550;x+=23)if(before.walkable(x,y)){originalSamples++;if(!after.walkable(x,y))changed++;}
assert.equal(changed,0,'original walking interior preserved');
const metrics=read('scripts/bigger-canal/metrics.json');assert.ok(metrics.landRatio>=2.7&&metrics.landRatio<=3.8);assert.ok(art.ground.tiles.every(t=>t.width<=1536&&t.height<=1536));
const result={passed:!fails.length,fails,checks,originalSamples,changedOriginalWalk:changed,originalProps:old.props.length,sleepers:ready.sleepers.length,landRatio:metrics.landRatio,walkableArea:ok.reduce((a,b)=>a+b,0)*G*G,reachedArea:seen.reduce((a,b)=>a+b,0)*G*G};fs.writeFileSync('scripts/bigger-canal/validation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,checks:checks.length},null,2));assert.equal(fails.length,0,fails.join('\n'));
