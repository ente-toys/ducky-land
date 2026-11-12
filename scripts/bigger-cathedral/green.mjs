// Run after the existing Cathedral build. This lane owns greenery and roads
// only. Source snapshots are local/repository data so rebuilding needs no git
// history or concepts directory. Water SVG groups are copied byte-for-byte.
import fs from 'node:fs';
import {rebuildPaths} from './paths.mjs';
import {JSDOM} from 'jsdom';
import {CLUMPS,LINKS} from './green-data.mjs';
import {smooth} from './design.mjs';
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/',B='scripts/bigger-cathedral/green-source/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const art=read(B+'art.json'),world=read(B+'world.json'),walk=read(B+'walk-world.json');
const dom=s=>new JSDOM(s,{contentType:'image/svg+xml'}).window.document.documentElement;
const svg=(w,h,box,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box}">${body}</svg>`;
const paths=world.paths.map(p=>structuredClone(p));
// The north-east lane now joins the existing village road, rather than ending
// alone behind the first house. All crossing and dock endpoints are retained.
paths[16].push([7896.67,1996.67]);
const widths=paths.map((p,i)=>i<19?128:104);
const source=dom(fs.readFileSync(B+'extension.svg','utf8'));
const extension=source.children[1];
// Keep the exact coast, beach, grass perimeter and every water layer. Remove
// the old meadow repeat, road outlines, ruts and edge scallop carpets.
for(const n of [...extension.children].slice(4))n.remove();
// Roads are owned exclusively by paths.mjs.
for(const t of art.ground.tiles.filter(t=>t.src.endsWith('.svg')&&!t.src.startsWith('communities/preserved-')))fs.writeFileSync(A+t.src,svg(t.width,t.height,`${t.x} ${t.y} ${t.width} ${t.height}`,source.innerHTML));
// Restore native vectors for the inner tile layer. All floor paths, pads,
// pond banks, forecourt and stone details remain in their original order.
const native=dom(fs.readFileSync('scripts/bigger-cathedral/baseline/ground.svg','utf8'));
const children=[...native.children];children[17].remove();
for(let i=18;i<40;i++)children[i].remove();
// The tiny existing symbols survive only along paths and at buildings. Open
// lawn no longer carries a uniform all-over sprinkle.
const distance=(x,y,p)=>{let d=Infinity;for(let i=1;i<p.length;i++){let a=p[i-1],b=p[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));d=Math.min(d,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));}return d;};
for(const n of native.querySelectorAll('use')){const x=+n.getAttribute('x'),y=+n.getAttribute('y');const d=Math.min(...paths.slice(0,11).map(p=>distance(x,y,p)));if(d<72||d>160)n.remove();}
// Plain pale/striped lawn rectangles are ground dressing, not protected pads.
for(const n of native.querySelectorAll('rect'))if(!n.closest('defs')&&['#A6B94D','#B4C560','#B2C855','#CAD68A'].includes(n.getAttribute('fill')))n.remove();
// Match the original PNG layer's coast/islet mask exactly, so restoring
// vectors does not paint the source's sea grain or shoreline outside its land.
const oldWorld=read('scripts/bigger-cathedral/baseline/world.json');
const originalMask=`<path d="M${oldWorld.coast.map(p=>p.join(',')).join('L')}Z"/>`+oldWorld.islets.map(([x,y,rx,ry])=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`).join('');
const nativeBody=`<defs><clipPath id="green-native-land">${originalMask}</clipPath></defs><g clip-path="url(#green-native-land)">${native.innerHTML}</g>`;
for(const t of art.ground.tiles.filter(t=>t.src.startsWith('communities/preserved-'))){const src=t.src.replace('.png','.svg');fs.writeFileSync(A+src,svg(t.width,t.height,`${t.x} ${t.y} ${t.width} ${t.height}`,nativeBody));t.src=src;}
const sleeperIds=new Set(Object.values(world.sleepSpots).flat().filter(p=>typeof p[0]==='string').map(p=>p[0]));
const community=p=>/^(bellpeep|olivello|tessera|crumbbell)-/.test(p.id??'')||/^dense-/.test(p.id??'')||/^olive-working-/.test(p.id??'');
const tree=p=>/^(reuse\/tree-\d|detail\/olive-tree)/.test(p.src);
const bush=p=>/^reuse\/bush-/.test(p.src);
const removed=[];
art.props=art.props.filter(p=>{const drop=p.name==='Daisy flower border'||(!community(p)&&!sleeperIds.has(p.id)&&(tree(p)||bush(p)||/^commons-flowers-/.test(p.id??'')||p.name==='Grove flowers'));if(drop)removed.push(p);return !drop;});
// Remove isolated lawn toys/picnic dressing. Furniture on the piazza and all
// community amenities stay. The named beach and pond scenes remain intact.
const retiredIds=new Set(['cathedral-399','cathedral-400','cathedral-401']);
art.props=art.props.filter(p=>!retiredIds.has(p.id));
art.flats=art.flats.filter(p=>!p.src.endsWith('street--picnic-blanket.svg'));
const sizes={o:[300,280,'detail/olive-tree.svg'],p:[150,380,'reuse/tree-5.svg'],g:[260,360,'reuse/tree-1.svg'],b:[168,110,'reuse/bush-2.svg']};
for(const [id,members]of CLUMPS)for(const [i,[x,y,type,k]]of members.entries()){const [w,h,src]=sizes[type];art.props.push({id:`green-${id}-${i}`,name:type==='b'?'Clump garden bush':'Clump garden tree',src,x,y,width:w,height:h,scale:k,anchor:{x:.5,y:.98},flip:false});}
// Delete trunk solids only when their associated tree was removed. Keep all
// architectural collision, water, deck supports and sleeper anchors intact.
for(const target of [world,walk])target.obstacles=target.obstacles.filter(o=>!removed.some(p=>tree(p)&&o.x!==undefined&&Math.abs(o.x-p.x)<3&&Math.abs(o.y-p.y)<100&&o.rx<100&&o.ry<100));
for(const p of art.props.filter(p=>p.id?.startsWith('green-')&&p.name==='Clump garden tree'))for(const target of [world,walk])target.obstacles.push({id:p.id,x:p.x,y:p.y-10,rx:18,ry:12});
// Porch links are visual frontage, not main-road sleeper exclusion lines.
world.paths=paths;world.pathWidths=widths;world.props=art.props;
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
save('scripts/bigger-cathedral/green-metrics.json',{removedDaisyBorders:removed.filter(p=>p.name==='Daisy flower border').length,removedTrees:removed.filter(tree).length,removedBushes:removed.filter(bush).length,clumps:CLUMPS.length,addedTrees:CLUMPS.flatMap(c=>c[1]).filter(p=>p[2]!=='b').length,addedBushes:CLUMPS.flatMap(c=>c[1]).filter(p=>p[2]==='b').length,retainedSleeperTrees:[...sleeperIds],vectorInnerTiles:32,doorAndJunctionLinks:LINKS.length});
console.log(read('scripts/bigger-cathedral/green-metrics.json'));

rebuildPaths();
