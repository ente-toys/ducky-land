import sharp from 'sharp';import fs from 'node:fs';
import {ART,OUT,original,origin,width,height,places,props,harbor,read,additions} from './model.mjs';import {svg} from './ground.mjs';
export async function render({old=false,built=false,crop=null,label=false}={}){
 const a=built?read(ART+'art.json'):original.art,k=crop?.k??.11,W=crop?.w??1540,H=crop?.h??1144,ox=crop?crop.x-W/(2*k):origin.x,oy=crop?crop.y-H/(2*k):origin.y;
 const layers=[],cache=new Map();
 async function add(p,kind){let s=kind==='prop'?(p.scale??1):1,w=Math.max(1,Math.round(p.width*s*k)),h=Math.max(1,Math.round(p.height*s*k));const anchor=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};let x=Math.round((p.x-ox)*k-anchor.x*w),y=Math.round((p.y-oy)*k-anchor.y*h);if(x>=W||y>=H||x+w<=0||y+h<=0)return;const key=[p.src,w,h,p.flip].join('|');let b=cache.get(key);if(!b){let im=sharp(additions[p.src]?Buffer.from(additions[p.src]):p.raw?p.src:ART+p.src).resize(w,h,{fit:'fill'});if(p.flip)im=im.flop();b=await im.png().toBuffer();cache.set(key,b);}const l=Math.max(0,x),t=Math.max(0,y),cw=Math.min(w-Math.max(0,-x),W-l),ch=Math.min(h-Math.max(0,-y),H-t);if(cw<=0||ch<=0)return;layers.push({input:await sharp(b).extract({left:Math.max(0,-x),top:Math.max(0,-y),width:cw,height:ch}).toBuffer(),left:l,top:t});}
 if(old){for(const p of original.art.ground.tiles)await add(p,'ground');}
 else if(built){for(const p of a.ground.tiles)await add(p,'ground');}
 else layers.push({input:await sharp(Buffer.from(svg(ox,oy,W/k,H/k))).resize(W,H).png().toBuffer(),left:0,top:0});
 for(const p of a.flats)await add(p,'flat');for(const p of a.decks)await add(p,'ground');for(const p of a.floating??[])await add({...p,x:p.x-p.width/2,y:p.y-p.height/2},'ground');
 const things=old||built?[...a.props]:[...a.props,...props];
 const poses=read('src/pixi/sleep-poses.json'),beds=read(ART+'resolved-sleepers.json');
 for(const b of beds){const p=poses.poses[b.pose],u=p.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=p.box;for(const l of p.layers){const m=await sharp('public'+l.src).metadata(),w=m.width/poses.F*u,h=m.height/poses.F*u;things.push({src:'public'+l.src,raw:true,x:b.x,y:b.y,width:w,height:h,scale:1,anchor:{x:b.flip?1-(x0+x1)/2*u/w:(x0+x1)/2*u/w,y:y1*u/h},flip:b.flip});}}
 if(!old){const j=harbor.jetty;await add({src:'public/pixi-art/bridge-jetty-1.svg',raw:true,x:j.foot[0]-95,y:j.foot[1]-30,width:190,height:j.tip[1]-j.foot[1]+60},'ground');}
 for(const p of things.sort((a,b)=>a.y-b.y))await add(p,'prop');
 if(label){let tags=places.map(z=>`<text x="${(z.x-ox)*k}" y="${(z.y+780-oy)*k}" text-anchor="middle" font-family="Arial" font-size="16" fill="#39472d" stroke="#fff0c7" stroke-width="5" paint-order="stroke">${z.name}</text>`).join('');layers.push({input:Buffer.from(`<svg width="${W}" height="${H}">${tags}</svg>`),left:0,top:0});}
 return sharp({create:{width:W,height:H,channels:4,background:a.sea}}).composite(layers).png().toBuffer();
}
if(process.argv.includes('--drawing')){fs.writeFileSync(OUT+'/library-now.png',await render({old:true}));fs.writeFileSync(OUT+'/library-communities.png',await render({label:true}));console.log('Drawing and baseline rendered before build');}
if(process.argv.includes('--built')){
 fs.mkdirSync(OUT+'/library-community-crops',{recursive:true});
 fs.writeFileSync(OUT+'/library-built.png',await render({built:true}));
 for(const z of places)fs.writeFileSync(`${OUT}/library-community-crops/${z.id}.png`,await render({built:true,crop:{x:z.x,y:{quillwick:800,inkleaf:1100,bedtime:5100,paperboat:5200}[z.id],k:.8,w:2600,h:2800}}));
 for(const c of [{id:'road-junction',x:-650,y:900},{id:'residential-lane',x:8800,y:1900}])fs.writeFileSync(`${OUT}/library-community-crops/${c.id}.png`,await render({built:true,crop:{x:c.x,y:c.y,k:.8,w:1400,h:1000}}));
 const pieces=[{input:OUT+'/library-communities.png',left:0,top:50},{input:OUT+'/library-built.png',left:1540,top:50},{input:Buffer.from('<svg width="3080" height="50"><rect width="3080" height="50" fill="#fff0c7"/><text x="25" y="33" font-family="Arial" font-size="24" fill="#39472d">DRAWING / four Pagepond communities</text><text x="1565" y="33" font-family="Arial" font-size="24" fill="#39472d">BUILT / production manifest and SVG tiles</text></svg>'),left:0,top:0}];
 await sharp({create:{width:3080,height:1194,channels:4,background:'#6ec9de'}}).composite(pieces).png().toFile(OUT+'/library-communities-vs-built.png');
 const ref=await sharp('../concepts/themes/world-map/cursor-camp-paths-ref.jpg').resize(800,600).png().toBuffer();
 const crops=await Promise.all(['road-junction','residential-lane'].map(async(id,i)=>({input:await sharp(`${OUT}/library-community-crops/${id}.png`).resize(800,600,{fit:'contain',background:'#fff0c7'}).toBuffer(),left:800*(i+1),top:40})));
 await sharp({create:{width:2400,height:640,channels:4,background:'#fff0c7'}}).composite([{input:ref,left:0,top:40},...crops,{input:Buffer.from('<svg width="2400" height="40"><g font-family="Arial" font-size="22" fill="#39472d"><text x="20" y="28">REFERENCE / look only</text><text x="820" y="28">BUILT / junction</text><text x="1620" y="28">BUILT / residential lane</text></g></svg>'),left:0,top:0}]).png().toFile(OUT+'/library-paths-vs-reference.png');
 console.log('Built overview, comparison, four neighbourhood crops and two path crops at 0.8 px/unit');
}
