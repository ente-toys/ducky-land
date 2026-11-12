// Sole Bellovo road painter. Rebuildable from checked-in terrain and authored controls.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
import {routes as authored,bridges,destinationCourts} from './paths-data.mjs';
import {VILLAGES} from './villages-data.mjs';
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/',S='scripts/bigger-cathedral/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');
const dom=s=>new JSDOM(s,{contentType:'image/svg+xml'}).window.document.documentElement;
export function sample(points,straight=false,straightStart=false){
 const out=[];for(let i=0;i<points.length-1;i++){
  const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)],n=Math.max(2,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/10));
  for(let j=0;j<n;j++){const t=j/n;out.push([0,1].map(k=>+((straight||straightStart&&i===0)?b[k]+(c[k]-b[k])*t:.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)).toFixed(3)));}
 }return [...out,points.at(-1)];
}
export function rebuildPaths(){
 const art=read(A+'art.json'),world=read(D+'world.json');
 const routes=structuredClone(authored),courts=structuredClone(destinationCourts);
 for(const v of VILLAGES){
  courts.push({id:v.id+'-court',x:v.square[0],y:v.square[1],rx:415,ry:205});
  for(const o of v.pieces.filter(o=>/building|house|workplace/.test(o.role))){
   const p=art.props.find(p=>p.id===v.id+'-'+o.id),door=[p.x,p.y+40],s=v.square;
   // South-facing homes are served around the side, never through their footprint.
   let points;
   if(o.id.includes('house-south')){
    if(v.id==='olivello')points=[door,[p.x+200,p.y+100],[s[0]-300,s[1]+190]];
    else if(v.id==='tessera')points=[door,[p.x+(o.id.includes('southeast')?-120:200),p.y+100],[s[0]+(o.id.includes('southeast')?220:-80),s[1]+230]];
    else points=[door,[p.x+220,p.y+100],[s[0]+280,s[1]+170]];
   }else if(Math.abs(p.x-s[0])>450)points=[door,[p.x,p.y+100],[s[0]+Math.sign(p.x-s[0])*340,p.y+100]];
   else points=[door,[p.x,s[1]-100]];
   if(o.id.includes('house-south'))points.splice(1,0,[p.x,p.y+110]);
   routes.push({id:p.id+'-door',width:104,points,terminal:'doorstep'});
  }
 }
 // Approach each end along the physical bridge tangent. Curves branch on dry ground,
 // 160 units back from the water, so their rounded shoulders cannot pinch the channel.
 for(const b of bridges)for(const side of ['a','b']){
  const end=b[side],dx=b.b[0]-b.a[0],dy=b.b[1]-b.a[1],len=Math.hypot(dx,dy),sign=side==='a'?-1:1;
  const back=b.id==='south-east-0'&&side==='b'?80:160;
  const dry=[end[0]+sign*dx/len*back,end[1]+sign*dy/len*back];
  for(const r of routes.filter(r=>!r.id.startsWith('bridge-')&&!r.id.startsWith('throat-')))r.points=r.points.map(p=>Math.hypot(p[0]-end[0],p[1]-end[1])<.01?dry:p);
  routes.push({id:'throat-'+b.id+'-'+side,width:b.w,points:[end,dry],terminal:'bridge landing'});
 }
 for(const r of routes)r.samples=sample(r.points,r.id.startsWith('bridge-')||r.id.startsWith('throat-'),r.id.endsWith('-door'));
 save(S+'paths-input.json',{routes,courts,bridges});
 execFileSync('python3',[S+'paths-geometry.py'],{stdio:'inherit'});
 const surface=fs.readFileSync(S+'path-surface.svgfrag','utf8');
 // Keep the original perimeter, islets and coast camera, remove ALL inherited roads,
 // route edging, old floor pads and obsolete forecourt replicas at their source.
 const native=dom(fs.readFileSync(S+'baseline/ground.svg','utf8'));
 const old=read(S+'baseline/world.json');
 const outline='M'+old.coast.map(p=>p.join(',')).join('L')+'Z';
 const mask=`<path d="${outline}"/>`+old.islets.map(([x,y,rx,ry])=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`).join('');
 const original=`<defs><clipPath id="paths-original-land">${mask}</clipPath></defs><g clip-path="url(#paths-original-land)" data-name="Retired inner coast"><path d="${outline}" fill="#93B72F"/>${old.islets.map(([x,y,rx,ry])=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#93B72F"/>`).join('')}</g>`;
 const ext=dom(fs.readFileSync(S+'green-source/extension.svg','utf8'));
 const extension=ext.children[0].outerHTML+`<g mask="url(#extension)">${[...ext.children[1].children].slice(0,4).map(n=>n.outerHTML).join('')}</g>`;
 const coast='M'+world.coast.map(p=>p.join(',')).join('L')+'Z';
 const fore=native.querySelector('[clip-path="url(#close-forecourt)"]');
 const mosaics=fore?fore.previousElementSibling.outerHTML+fore.outerHTML:'';
 const layer=`<defs><clipPath id="paths-current-coast"><path d="${coast}"/></clipPath></defs><g clip-path="url(#paths-current-coast)">${surface}</g>`;
 // Identical global surface in both support grids, with full world-sized viewBoxes.
 // Nothing is clipped to a tile in geometry, so adjacent textures meet on the same contour.
 for(const t of art.ground.tiles.filter(t=>t.src.startsWith('communities/'))){
  const ground=t.src.includes('preserved-')?original:extension;
  fs.writeFileSync(A+t.src,`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${t.width}" height="${t.height}" viewBox="${t.x} ${t.y} ${t.width} ${t.height}">${ground}${layer}</svg>`);
 }
 world.paths=routes.map(r=>r.samples);world.pathWidths=routes.map(r=>r.width);
 world.pathSystem={version:1,color:'#F7DC88',mainWidth:128,laneWidth:104,painter:S+'paths.mjs',routes:routes.map(({id,width,terminal})=>({id,width,terminal}))};
 save(D+'world.json',world);
 // walk-world has an independently traced water mask. Only reconcile route fields.
 const walk=read(D+'walk-world.json');walk.paths=world.paths;walk.pathWidths=world.pathWidths;walk.pathSystem=world.pathSystem;save(D+'walk-world.json',walk);
 console.log('Bellovo sole gold painter:',routes.length,'routes,',bridges.length,'fixed bridges');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)rebuildPaths();
