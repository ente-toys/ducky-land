import {readFileSync,writeFileSync} from 'node:fs';
import {mapFor} from '../../src/pixi/island-maps.js';
import {IslandRoom} from '../../worker/index.js';
const map=mapFor('sunflower'),nav=map.nav(),authority=IslandRoom.prototype.navFor.call({},'blossom');
const routes=JSON.parse(readFileSync('scripts/sunbob-ground/sampled-routes.json'));
const bad=[];let samples=0;
for(const r of routes)for(const [x,y] of r.samples){samples++;if(!nav.walkable(x,y)||!authority.walkable(x,y))bad.push({id:r.id,x:Math.round(x),y:Math.round(y)});}
const report={samples,bad,byRoute:Object.fromEntries([...new Set(bad.map(b=>b.id))].map(id=>[id,bad.filter(b=>b.id===id).length]))};
writeFileSync('scripts/sunbob-ground/walk-audit.json',JSON.stringify(report,null,2)+'\n');console.log({samples,bad:bad.length,byRoute:report.byRoute,examples:bad.filter((p,i)=>!i||p.id!==bad[i-1].id)});
if(bad.length)process.exitCode=1;
