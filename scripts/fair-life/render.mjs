// Read-only adaptation of home-review/render.mjs. Writes only beside this file.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.cwd();
const out=process.cwd()+'/scripts/fair-life/evidence';
const require=createRequire(root+'/package.json'),sharp=require('sharp');
sharp.cache(false); sharp.concurrency(2);
const read=p=>JSON.parse(readFileSync(root+'/'+p));
const {mapFor}=await import(root+'/src/pixi/island-maps.js');
const views=[['whole',[-2500,-1800,12000,8200],.18],['hill',[6900,480,1550,1250],.8],['picnic',[4450,4140,1450,1060],.8],['nw',[-1450,-200,1700,1700],.65],['sw',[-1550,3100,1500,1800],.65],['se',[5300,4080,1700,1350],.65]];
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
 // Static t=0 sample of the exact Home split kite artwork and pose formula.
 // Motion itself is exercised against createHomeKites in fair-life.test.mjs.
 const nested=(src,x,y,w,h)=>{let svg=readFileSync(root+'/public/pixi-art/home-kites/'+src,'utf8');svg=svg.replace(/<svg\b[^>]*>/,tag=>tag.replace(/ (width|height)="[^"]*"/g,''));return svg.replace('<svg ',`<svg x="${x}" y="${y}" width="${w}" height="${h}" `);};
 const kiteSvg=(art.kites??[]).map(s=>{const phase=s.phase,x=s.lean+Math.sin(phase)*13,y=-s.height+Math.sin(phase*1.31+.7)*6,rot=(-.06+Math.sin(phase+.4)*.045)*180/Math.PI,ta=Math.sin(s.phase)*.065*180/Math.PI,tb=Math.sin(s.phase+1.4)*.08*180/Math.PI;return `<g transform="translate(${s.x} ${s.y})"><path d="M0 -17Q${74*x/100} ${-17-65*(-y-17)/200} ${x} ${y}" fill="none" stroke="#39472d" stroke-width="1.8"/>${nested('stake.svg',-18.5,-26,38,34)}<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s.size})"><g transform="rotate(${ta})">${nested(s.colour+'-tail-a.svg',-2,-2,88,82)}</g><g transform="rotate(${tb})">${nested(s.colour+'-tail-b.svg',-2,-2,94,62)}</g>${nested(s.colour+'-body.svg',-34,-112,112,120)}</g></g>`;}).join('');
 layers.push({input:await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${view.join(' ')}">${kiteSvg}</svg>`)).png().toBuffer(),left:0,top:0});

 const file=theme==='community'?'reference/'+name+'.png':name==='whole'?'whole.png':'close/'+name+'.png';
 mkdirSync(path.dirname(out+'/'+file),{recursive:true});
 await sharp({create:{width:W,height:H,channels:4,background:art.sea??'#6EC9DE'}}).composite(layers).png().toFile(out+'/'+file);
 summary.push({theme,file,view,scale:k,size:[W,H],props:art.props.length,sleepers:beds.length});
 console.log(file+' '+W+'x'+H);
}
const only=process.env.FAIR_RENDER_ONLY?.split(',');
for(const [name,view,k] of views)if(!only||only.includes(name))await render('fair',name,view,k);


if(only){const previous=JSON.parse(readFileSync(out+'/views.json'));summary.push(...previous.filter(v=>!summary.some(s=>s.file===v.file)));}
writeFileSync(out+'/views.json',JSON.stringify(summary,null,2));
writeFileSync(out+'/render-provenance.json',JSON.stringify({root,commit:'uncommitted fair-life pass',adaptedFrom:'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/home-review/render.mjs',note:'Read-only SVG assembly. Current manifest ground/decks/flats/props, runtime registry sleepers (not the stale sleepers-resolved.json), current approved boat headings, theme contact shadows. Kites show a static t=0 pose. No live players, animated water, kite motion, procedural harbour, ocean shader or UI. PNGs are static production-art composites, not in-game screenshots.',views:summary.length},null,2));
