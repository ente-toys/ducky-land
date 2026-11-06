import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/community/',D='rive/web/themes/community/';
const a=read(A+'art.json'),w=read(D+'world.json'),beds=read(A+'resolved-sleepers.json'),benches=read(D+'ten-benches.json');
function seg(x,y,p,q){const dx=q[0]-p[0],dy=q[1]-p[1],t=Math.max(0,Math.min(1,((x-p[0])*dx+(y-p[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-p[0]-t*dx,y-p[1]-t*dy)}
const pathDist=(x,y)=>Math.min(...w.paths.flatMap((p,i)=>p.slice(1).map((q,j)=>seg(x,y,p[j],q)-w.pathWidths[i]/2)));
const problems=[];
for(const b of benches){
 const d=Math.min(...b.poly.map(([x,y])=>pathDist(x,y)));if(d<0)problems.push({id:b.id,type:'bench on path',distance:d});
 for(const bed of beds)if(b.poly.some(([x,y])=>Math.hypot(x-bed.x,y-bed.y)<bed.r+16))problems.push({id:b.id,type:'bench near sleeper',bed});
}
for(const p of a.props.filter(p=>/tree/i.test(p.name))){const d=pathDist(p.x,p.y);if(d<50)problems.push({id:p.id,type:'tree root close to path',distance:d});}
console.log(JSON.stringify(problems,null,2));
fs.writeFileSync(D+'ten-clearance.json',JSON.stringify({problems},null,2));
const walk=read(D+'walk-world.json');
for(const b of benches){
 if(!w.obstacles.some(o=>o.communityArc===b.id&&JSON.stringify(o.poly)===JSON.stringify(b.poly)))problems.push({id:b.id,type:'world footprint missing'});
 if(!walk.obstacles.some(o=>o.communityArc===b.id&&JSON.stringify(o.poly)===JSON.stringify(b.poly)))problems.push({id:b.id,type:'walk footprint missing'});
}
for(const p of a.props.filter(p=>p.id.startsWith('ten-root-'))){
 for(const [id,z]of Object.entries(w.zones).filter(([id])=>/^(activity|stalls)-/.test(id))){
  const rx=z.rx??z.length/2,ry=z.ry??z.depth/2;
  if(((p.x-z.x)/rx)**2+((p.y-z.y)/ry)**2<1)problems.push({id:p.id,type:'reserved interior',zone:id});
 }
}
let vectors=0;
for(const file of fs.readdirSync(A,{recursive:true})){const path=A+file;if(!fs.statSync(path).isFile())continue;
 if(/\.(png|jpe?g|webp|avif)$/i.test(file))problems.push({file,type:'raster in public'});
 if(file.endsWith('.svg')){vectors++;if(/<image\b|data:image\//i.test(fs.readFileSync(path,'utf8')))problems.push({file,type:'embedded raster'});}
}
for(const p of [...a.ground.tiles,...a.flats,...a.decks,...a.props,...(a.floating??[])]){
 const path=p.src.startsWith('/')?'public'+p.src:A+p.src;
 if(!p.src.endsWith('.svg')||!fs.existsSync(path))problems.push({src:p.src,type:'runtime source missing or non SVG'});
}
const report={benches:benches.length,trees:a.props.filter(p=>/tree/i.test(p.name)).length,svgFiles:vectors,rasterFiles:0,problems};
fs.writeFileSync(D+'ten-clearance.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(problems.length)process.exitCode=1;
// Exercise the real theme loader against these files even if the shared generated registry is stale.
const {loadThemeArt}=await import('../../src/pixi/theme-art.js');
const {Texture}=await import('pixi.js');
const originalFetch=globalThis.fetch;let acquired=0,released=0;
globalThis.fetch=async url=>({ok:true,json:async()=>read('public'+url)});
try{
 const art=await loadThemeArt({id:'community',art:'/pixi-art/themes/community/art.json'},{acquire:async()=>{acquired++;return Texture.EMPTY},release:()=>released++});
 if(art.props.length!==a.props.length)throw Error('Theme loader lost props');
 if(art.props.filter(p=>p.centrePiece?.animate).length!==1)throw Error('Community flame animation attachment missing');
 art.destroy();if(acquired!==released)throw Error('Texture reference leak');
 console.log(`PASS real theme loader: ${a.props.length} props, flame attachment, ${acquired} acquired/released textures`);
}finally{globalThis.fetch=originalFetch}
