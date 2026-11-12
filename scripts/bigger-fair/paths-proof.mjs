// Read-only adaptation of home-review/render.mjs. Writes only beside this file.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.cwd();
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair-review/fix/paths';
const require=createRequire(root+'/package.json'),sharp=require('sharp');
sharp.cache(false); sharp.concurrency(2);
const read=p=>JSON.parse(readFileSync(root+'/'+p));
const {mapFor}=await import(root+'/src/pixi/island-maps.js');
const views=[
 ['whole',[-2800,-2100,12600,8900],.27],
 ['01-centre',[2050,1480,3000,2550],.65],
 ['02-castle-lagoon',[2350,-30,2450,1850],.8],
 ['03-west-bridges',[-1900,2450,3000,1550],.7],
 ['04-east-brook',[6500,1150,3100,1900],.65],
 ['05-north-landings',[2750,-500,1800,1650],.85],
 ['06-south-harbour',[2350,3500,2300,2600],.65],
 ['07-bobbinbell',[-2000,450,2750,2750],.65],
 ['08-cloudpop',[1600,-1250,4000,1800],.65],
 ['09-sugarspoon',[300,4200,3400,2000],.65],
 ['10-waddleshow',[6850,2200,2450,2600],.65],
 ['11-northwest-seam',[-900,-300,2350,2050],.8],
 ['12-northeast-seam',[5450,-250,2200,2000],.8],
 ['13-west-empty',[-1200,-700,2200,1600],.7],
 ['14-east-empty',[4700,4200,2300,1700],.7],
 ['15-southwest-seam',[0,3000,2000,1800],.8],
];
const summary=[];
async function render(theme,name,view,k){
 const art=read('public/pixi-art/themes/'+theme+'/art.json'),base=root+'/public/pixi-art/themes/'+theme+'/';
 const beds=mapFor(theme).sleepers;
 const h=read('assets/world/themes/'+theme+'/harbor.json'),poses=read('src/pixi/sleep-poses.json');
 const [ox,oy,cw,ch]=view,W=Math.round(cw*k),H=Math.round(ch*k),layers=[],cache=new Map();
 const source=s=>s.startsWith('/pixi-art/')||s.startsWith('/pixi-duck/')?root+'/public'+s:s.startsWith('/assets/')?root+s:path.isAbsolute(s)?s:base+s;
 async function add(p,kind='prop'){
  const scale=kind==='prop'?(p.scale??1):1;
  let w=Math.max(1,Math.round(p.width*scale*k)),hh=Math.max(1,Math.round(p.height*scale*k));
  if(kind==='ground'){w=Math.round((p.x+p.width-ox)*k)-Math.round((p.x-ox)*k);hh=Math.round((p.y+p.height-oy)*k)-Math.round((p.y-oy)*k);}
  const a=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};
  const x=Math.round((p.x-ox)*k-a.x*w),y=Math.round((p.y-oy)*k-a.y*hh);
  if(x>=W||y>=H||x+w<=0||y+hh<=0)return;
  const key=[p.src,w,hh,p.flip,p.tint].join('|');let buf=cache.get(key);
  if(!buf){let im=sharp(source(p.src),{density:Math.max(72,72*k)}).resize(w,hh,{fit:'fill'});if(p.flip)im=im.flop();if(p.tint){const c=p.tint;im=im.linear([(c>>16&255)/255,(c>>8&255)/255,(c&255)/255,1],[0,0,0,0]);}buf=await im.png().toBuffer();cache.set(key,buf);}
  const left=Math.max(0,x),top=Math.max(0,y),ww=Math.min(w-Math.max(0,-x),W-left),h2=Math.min(hh-Math.max(0,-y),H-top);
  if(ww!==w||h2!==hh)buf=await sharp(buf).extract({left:Math.max(0,-x),top:Math.max(0,-y),width:ww,height:h2}).png().toBuffer();
  layers.push({input:buf,left,top});
 }
 for(const p of art.ground.tiles)await add(p,'ground');
 for(const p of art.flats??[])await add(p,'flat');
 for(const p of art.decks??[])await add(p,'deck');
 // theme-art.js:105-111, including custom footprints and offsets.
 const shadows=[];
 for(const p of art.props){const n=p.name??p.asset??p.src;if(/bunting|banner|flag|bridge|blanket|lily|shell|reeds|rug|path|paving/i.test(n)||p.shadow===false)continue;
  const r=Math.max(8,Math.min(300,p.width*(p.scale??1)*.36)),[rx,ry]=p.shadowSize??[r,r*.3];
  const cx=p.x+(p.shadowOffset?.[0]??0)+rx*.06,cy=p.y+(p.shadowOffset?.[1]??0)+ry*.1;
  shadows.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`);
 }
 const shadowSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${view.join(' ')}"><g fill="#3c5a2a" opacity=".15">${shadows.join('')}</g></svg>`;
 layers.push({input:await sharp(Buffer.from(shadowSvg)).png().toBuffer(),left:0,top:0});
 for(const p of art.floating??[])await add({...p,scale:1,anchor:p.anchor??{x:.5,y:.5}});
 const props=[...art.props];
 for(const b of beds){const p=poses.poses[b.pose],u=p.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=p.box;
  for(const l of p.layers){const m=await sharp(source(l.src)).metadata(),width=m.width/poses.F*u,height=m.height/poses.F*u;props.push({src:l.src,x:b.x,y:b.y,width,height,scale:1,anchor:{x:b.flip?1-(x0+x1)/2*u/width:(x0+x1)/2*u/width,y:y1*u/height},flip:b.flip});}}
 // Approved current boat views, same dimensions and anchoring as boat-views.js.
 const bm=read('public/pixi-art/boat/views.json');
 for(const b of h.boats??[]){const v=Object.values(bm.views).reduce((a,v)=>Math.abs(Math.atan2(Math.sin(v.deg*Math.PI/180-b.turn),Math.cos(v.deg*Math.PI/180-b.turn)))<Math.abs(Math.atan2(Math.sin(a.deg*Math.PI/180-b.turn),Math.cos(a.deg*Math.PI/180-b.turn)))?v:a);
  const m=await sharp(root+'/public/pixi-art/boat/'+v.file).metadata(),width=v.width??bm.width;
  props.push({src:'/pixi-art/boat/'+v.file,x:b.x,y:b.y,width,height:width*m.height/m.width,scale:1,anchor:{x:(v.anchor??bm.anchor)[0],y:(v.anchor??bm.anchor)[1]},flip:v.mirror});}
 for(const p of props.sort((a,b)=>(a.z??a.sortY??a.y)-(b.z??b.sortY??b.y)))await add(p);
 const file=theme==='community'?'reference/'+name+'.png':name==='whole'?'whole.png':'close/'+name+'.png';
 mkdirSync(path.dirname(out+'/'+file),{recursive:true});
 await sharp({create:{width:W,height:H,channels:4,background:art.sea??'#6EC9DE'}}).composite(layers).png().toFile(out+'/'+file);
 summary.push({theme,file,view,scale:k,size:[W,H],props:art.props.length,sleepers:beds.length});
 console.log(file+' '+W+'x'+H);
}
const only=process.env.FAIR_RENDER_ONLY?.split(',');
for(const [name,view,k] of views)if(!only||only.includes(name))await render('fair',name,view,k);
if(!only)await render('community','campfire-centre',[2250,1450,3500,2600],.65);
if(!only)await render('community','campfire-whole',[-2800,-2000,13400,10000],.23);
if(only){const previous=JSON.parse(readFileSync(out+'/views.json'));summary.push(...previous.filter(v=>!summary.some(s=>s.file===v.file)));}
writeFileSync(out+'/views.json',JSON.stringify(summary,null,2));
writeFileSync(out+'/render-provenance.json',JSON.stringify({root,commit:'99bf8735095c9767bdc5a49152361ffb5cc06aac',adaptedFrom:'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/home-review/render.mjs',note:'Read-only SVG assembly. Current manifest ground/decks/flats/props, runtime registry sleepers (not the stale sleepers-resolved.json), current approved boat headings, theme contact shadows. No live players, animated water, kite motion, procedural harbour, ocean shader or UI. PNGs are static production-art composites, not in-game screenshots.',views:summary.length},null,2));
