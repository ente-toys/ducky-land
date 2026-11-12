import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {inCentre,centreClip,centre} from './centre-lock.mjs';
const A='public/pixi-art/themes/pink/',ref='7c2a28ec',git=p=>execFileSync('git',['show',ref+':'+p],{encoding:'utf8'}),read=p=>JSON.parse(readFileSync(p)),write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,1)+'\n');
const base=JSON.parse(git(A+'art.json')),art=read(A+'art.json');
// Preserve original tile placement/raster scale, SVG content, and original layer order.
const folder='expansion/locked-centre/';mkdirSync(A+folder,{recursive:true});
art.ground.tiles=art.ground.tiles.filter(t=>!t.src.startsWith(folder));
for(const [i,t]of base.ground.tiles.entries()){
 if(t.x>centre.x+centre.rx||t.x+t.width<centre.x-centre.rx||t.y>centre.y+centre.ry||t.y+t.height<centre.y-centre.ry)continue;
 const svg=git(A+t.src),open=svg.match(/<svg\b[^>]*>/)[0],content=svg.slice(svg.indexOf(open)+open.length).replace(/<\/svg>\s*$/,'');
 const src=folder+i+'.svg';writeFileSync(A+src,open+`<defs><clipPath id="locked-centre">${centreClip}</clipPath></defs><g clip-path="url(#locked-centre)">${content}</g></svg>`);art.ground.tiles.push({...t,src});
}
const touches=p=>{const w=p.width*(p.scale??1),h=p.height*(p.scale??1),a=p.anchor??{x:.5,y:1},x=p.x-(p.topLeft?0:a.x*w),y=p.y-(p.topLeft?0:a.y*h);return inCentre(Math.max(x,Math.min(x+w,centre.x)),Math.max(y,Math.min(y+h,centre.y)));};
const restored=[];
for(const key of ['flats','decks','props']){
 const ids=new Set(base[key].filter(p=>p.id&&((key==='props'?(touches(p)||touches(art.props.find(v=>v.id===p.id)??p)):inCentre(p.x,p.y))||['pink-close-plaza','pink-close-court','centre-back','centre-decal-plaza'].includes(p.id))).map(p=>p.id));
 // Restore complete original sprites, not cut-out sprite fragments.
 art[key]=art[key].filter(p=>!p.id||!ids.has(p.id)||base[key].some(b=>b.id===p.id));
 for(const b of base[key].filter(p=>ids.has(p.id))){const i=art[key].findIndex(p=>p.id===b.id);if(i>=0){if(JSON.stringify(art[key][i])!==JSON.stringify(b))restored.push(b.id);art[key][i]=b;}else art[key].push(b);if(!b.src.startsWith('/'))writeFileSync(A+b.src,git(A+b.src));}
}
write(A+'art.json',art);
for(const file of ['world.json','walk-world.json']){
 const path='assets/world/themes/pink/'+file,world=read(path),old=JSON.parse(git(path));
 world.obstacles=world.obstacles.filter(o=>!inCentre(o.x??-1e9,o.y??-1e9)).concat(old.obstacles.filter(o=>inCentre(o.x??-1e9,o.y??-1e9)));
 if(world.props)world.props=art.props;
 write(path,world);
}
const layout=read('scripts/bigger-pink/layout.json'),world=read('assets/world/themes/pink/world.json'),original=read('scripts/bigger-pink/original-world.json');layout.baseObstacles=world.obstacles.filter(o=>original.obstacles.some(b=>JSON.stringify(b)===JSON.stringify(o)));layout.obstacles=world.obstacles.filter(o=>!layout.baseObstacles.includes(o));write('scripts/bigger-pink/layout.json',layout);
const path='assets/world/themes/index.js',index=readFileSync(path,'utf8'),line=index.split('\n').find(l=>l.startsWith('  pink:')),oldLine=git(path).split('\n').find(l=>l.startsWith('  pink:')),beds=JSON.parse(line.match(/sleepers: (\[.*\])/)[1]),oldBeds=JSON.parse(oldLine.match(/sleepers: (\[.*\])/)[1]);
const occurrence=new Map();for(const b of oldBeds){const n=occurrence.get(b.pose)??0;occurrence.set(b.pose,n+1);if(!inCentre(b.x,b.y))continue;const current=beds.filter(c=>c.pose===b.pose)[n];Object.keys(current).forEach(k=>delete current[k]);Object.assign(current,b);}
const worldPath='assets/world/themes/pink/world.json',w=read(worldPath),ow=JSON.parse(git(worldPath));const occurrences=new Map();for(const b of oldBeds){const n=occurrences.get(b.pose)??0;occurrences.set(b.pose,n+1);if(inCentre(b.x,b.y))w.sleepSpots[b.pose][n]=ow.sleepSpots[b.pose][n];}write(worldPath,w);
writeFileSync(path,index.replace(line,line.replace(/sleepers: \[.*\]/,'sleepers: '+JSON.stringify(beds))));
write('scripts/pink-final/centre-lock-report.json',{ref,centre,restored,protectedProps:base.props.filter(p=>touches(p)||restored.includes(p.id)).map(p=>p.id),groundTiles:art.ground.tiles.filter(t=>t.src.startsWith(folder)).length});console.log('Restored locked centre:',restored);
