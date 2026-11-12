import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p)),write=(p,j)=>fs.writeFileSync(p,JSON.stringify(j)+'\n');
const B=read('scripts/pagepond-b/placements.json'),S=read('scripts/pagepond-b/shadows.json'),F=read('scripts/pagepond-b/filter.json'),A='public/pixi-art/themes/library/',D='assets/world/themes/library/',art=read(A+'art.json');
assert(!art.props.some(p=>p.id.startsWith('page-b-')),'B is already integrated; use verification scripts');
const shadow=new Map([...S.overrides,...S.newPlantOverrides,...S.newHillOverrides].map(p=>[p.id,p]));
function update(p){
 const replacement=B.planting.replace.find(r=>r.id===p.id),move=B.planting.moves.find(r=>r.id===p.id),s=shadow.get(p.id);
 if(replacement)for(const k of ['src','width','height','scale'])p[k]=replacement[k];
 if(move&&p.x!==move.x){p.x=move.x;p.y=move.y;if(p.footprint)translate(p.footprint,move.delta);}
 if(s)for(const k of ['shadow','shadowSize','shadowOffset'])if(k in s)p[k]=s[k];
 return p;
}
function translate(o,[dx,dy]){if(o.poly)o.poly=o.poly.map(([x,y])=>[x+dx,y+dy]);else{ o.x+=dx;o.y+=dy; }}
art.props=art.props.map(update);
const additions=[...B.planting.add.filter(p=>F.accepted.includes(p.id)),...B.hill.props].map(p=>update(structuredClone(p)));
for(const p of additions)if(!art.props.some(q=>q.id===p.id))art.props.push(p);
if(!art.flats.some(p=>p.id===B.hill.ground.id))art.flats.push(B.hill.ground);
art.kites=B.kites;
for(const p of S.stripBakedGroundShadows){let svg=fs.readFileSync(p.file,'utf8');const n=svg.split(p.exactElement).length-1;if(n===0&&!svg.includes(p.exactElement)) {
 const equivalent=p.exactElement.replace('/>',' />');assert.equal(svg.split(equivalent).length-1,1,p.file+' exact selector');svg=svg.replace(equivalent,'');
 }else{assert.equal(n,1,p.file);svg=svg.replace(p.exactElement,'');}fs.writeFileSync(p.file,svg);}
for(const f of ['world.json','walk-world.json']){const w=read(D+f);for(const o of w.obstacles){const m=B.planting.moves.find(m=>m.id===o.name);if(m)translate(o,m.delta);}for(const p of additions)if(!w.obstacles.some(o=>o.name===p.id))w.obstacles.push(p.footprint);if(w.props)w.props=art.props;if(f==='world.json'){w.sleepTotal=250;w.sleepSpots=B.sleepers.mergedSleepSpots;}write(D+f,w);}
write(A+'art.json',art);write(D+'placements.json',art.props);
for(const f of ['scripts/pagepond-hamlets/placement.json','scripts/bigger-library/plan.json']){const p=read(f);for(const k of ['props','trees','bushes','homes'])if(Array.isArray(p[k]))p[k]=p[k].map(update);write(f,p);}
console.log('Applied',additions.length,'props, 13 kites, 250 sleeper inputs, 15 shadow removals');
