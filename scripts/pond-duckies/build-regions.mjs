import fs from 'node:fs';
import sharp from 'sharp';
import {inShape} from '../../assets/world/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const home=read('assets/world/world.json'),exp=read('src/pixi/home-expansion.json');
const world=id=>id==='home'?home:read(`assets/world/themes/${id}/world.json`);
const assets=[['f4_ring',72,760,865],['g1_donut',72,852,779],['g4_paperboat',72,757,677],['g6_lounger',56,832,869],['g3_snorkel_c',46,770,544],['g2_padhat',40,639,441],['f6_peek',30,770,400]].map(([name,_,w,h])=>({name,height:64*h/865/.65,width:64*w/865/.65}));
const inventory=[];
const add=(island,id,shapes,pair,source)=>inventory.push({island,id,shapes,pair,source});
add('home','lily', [home.water[0]],[0,1],'assets/world/world.json water[0]');
add('home','race',[{poly:read('src/pixi/walk-shapes.json').lake}],[2,3],'src/pixi/walk-shapes.json lake');
add('home','west',[exp.water],[4,5],'src/pixi/home-expansion.json water');
add('home','millhead',[exp.riverWater.find(w=>w.id==='millhead-pond')],[5,6],'src/pixi/home-expansion.json millhead-pond');
add('home','millrill',[exp.riverWater.find(w=>w.id==='shore-millrill-pond')],[4,6],'src/pixi/home-expansion.json shore-millrill-pond');
add('sunflower','lily',[world('sunflower').water[0]],[0,2],'assets/world/themes/sunflower/world.json water[0]');
add('pink','willow-pond',[read('scripts/bigger-pink/original-world.json').water[0]],[1,3],'scripts/bigger-pink/original-world.json water[0], current continuous water');
for(const [i,p] of read('scripts/pink-fix/shore.json').ponds.entries())add('pink',p.id,[{poly:p.poly}],[i?3:0,i?5:4],'scripts/pink-fix/shore.json ponds, current continuous water');
add('library','reading',[world('library').water[0]],[3,6],'assets/world/themes/library/world.json Pagepond reading pond');
add('library','meadow',world('library').water.filter(w=>w.id?.startsWith('meadow-water-')),[2,4],'assets/world/themes/library/world.json meadow-water, island and treads subtracted');
add('community','lily',[world('community').water[0]],[1,5],'assets/world/themes/community/world.json water[0]');
add('fair','orchard',[world('fair').water[0]],[2,6],'assets/world/themes/fair/world.json wish-orchard-pond');
add('fair','castle-lagoon',world('fair').water.filter(w=>w.id==='ac2-lagoon'),[0,3],'assets/world/themes/fair/world.json ac2-lagoon, castle islet subtracted');
add('cathedral','lily',[{x:1770,y:3310,rx:430,ry:310}],[1,2],'scripts/bigger-cathedral/water-source/world.json water[0], current continuous water');
add('bog','kettle',[world('bog').water[2]],[1,6],'assets/world/themes/bog/world.json kettle-pond');
add('bog','reed',[world('bog').water[3]],[3,4],'assets/world/themes/bog/world.json reed-pond');
const bounds=shapes=>shapes.reduce((b,s)=>{const pts=s.poly??[[s.x-s.rx,s.y-s.ry],[s.x+s.rx,s.y+s.ry]];for(const [x,y] of pts){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}return b;},[Infinity,Infinity,-Infinity,-Infinity]);
async function paint(p,art,b){
 const x0=Math.floor(b[0]),y0=Math.floor(b[1]),W=Math.ceil(b[2])-x0+1,H=Math.ceil(b[3])-y0+1,layers=[];
 const base=p.island==='home'?'public/':`public/pixi-art/themes/${p.island}/`;
 const entries=p.island==='home'?[...read('src/pixi/art-manifest.json').ground.tiles,...exp.tiles]:art.ground.tiles;
 const flats=p.island==='home'?[]:art.flats??[];
 for(const e of [...entries.map(t=>({...t,topLeft:true})),...flats,...(art.floating??[]).map(f=>({...f,anchor:f.anchor??{x:.5,y:.5}}))]){
  const a=e.topLeft?{x:0,y:0}:e.anchor??{x:.5,y:1};
  const x=Math.round(e.x-e.width*a.x-x0),y=Math.round(e.y-e.height*a.y-y0),w=Math.round(e.width),h=Math.round(e.height);
  if(x>=W||y>=H||x+w<=0||y+h<=0)continue;
  const src=e.src.startsWith('/')?'public'+e.src:base+e.src;
  if(!fs.existsSync(src))continue;
  let image=sharp(src).resize(w,h,{fit:'fill'});if(e.flip)image=image.flop();
  const l=Math.max(0,-x),t=Math.max(0,-y),width=Math.min(w-l,W-Math.max(x,0)),height=Math.min(h-t,H-Math.max(y,0));
  layers.push({input:await image.extract({left:l,top:t,width,height}).png().toBuffer(),left:Math.max(x,0),top:Math.max(y,0)});
 }
 const pix=await sharp({create:{width:W,height:H,channels:4,background:'#6ec9de'}}).composite(layers).raw().toBuffer();
 const sums=new Uint32Array((W+1)*(H+1));
 for(let y=0;y<H;y++){let row=0;for(let x=0;x<W;x++){const k=(y*W+x)*4,r=pix[k],g=pix[k+1],bl=pix[k+2];row+=g>bl*1.2&&g>r*.80&&bl<170?1:0;sums[(y+1)*(W+1)+x+1]=sums[y*(W+1)+x+1]+row;}}
 return (x,y,r,ry)=>{for(let yy=Math.max(0,Math.floor(y-y0-ry));yy<Math.min(H,Math.ceil(y-y0+ry));yy++){
  const dy=(yy+.5-(y-y0))/ry,dx=r*Math.sqrt(Math.max(0,1-dy*dy));
  const l=Math.max(0,Math.floor(x-x0-dx)),rr=Math.min(W,Math.ceil(x-x0+dx));
  if(sums[(yy+1)*(W+1)+rr]-sums[yy*(W+1)+rr]-sums[(yy+1)*(W+1)+l]+sums[yy*(W+1)+l])return false;
 }return true;};
}
const out=[];
for(const p of inventory){
 const b=bounds(p.shapes),w=world(p.island),art=read(p.island==='home'?'src/pixi/art-manifest.json':`public/pixi-art/themes/${p.island}/art.json`);
 if(p.island==='home')art.props=[...(art.props??[]),...(exp.props??[])];
 const pair=p.pair.map(i=>assets[i]),radius=Math.max(...pair.map(a=>a.width/2))+10,radiusY=Math.max(...pair.map(a=>a.width*.17))+8,step=16;
 const origin=[Math.ceil(b[0]/step)*step,Math.ceil(b[1]/step)*step],cols=Math.ceil((b[2]-origin[0])/step)+1,rows=Math.ceil((b[3]-origin[1])/step)+1;
 const greenFree=await paint(p,art,b);
 const blockers=[];
 const walkways=p.island==='home'?[...(home.walkways??[]),...(exp.walkways??[]),...(exp.homeArches??[])]:w.walkways??[];
 for(const d of walkways){if(!d.a||!d.b)continue;const bridge=d.boatPassUnder||Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])>300;
  if(bridge){for(const v of [d.a,d.b])blockers.push({x:v[0],y:v[1],rx:d.w/2+12,ry:d.w/2+12});}
  else{const n=Math.ceil(Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])/16);for(let k=0;k<=n;k++)blockers.push({x:d.a[0]+(d.b[0]-d.a[0])*k/n,y:d.a[1]+(d.b[1]-d.a[1])*k/n,rx:d.w/2,ry:d.w/2});}
 }
 for(const f of [...art.floating??[],...(art.props??[]).filter(q=>/paper-boat|lily-pad|pond-dock/.test(q.src))]){
  const s=f.scale??1;blockers.push({x:f.x,y:f.y,rx:f.width*s/2+5,ry:f.height*s/3+5});
 }
 const relevant=blockers.filter(s=>s.x+s.rx>b[0]&&s.x-s.rx<b[2]&&s.y+s.ry>b[1]&&s.y-s.ry<b[3]);
 const wet=(x,y)=>p.shapes.some(s=>inShape(x,y,s))&&(p.island==='home'||w.water.some(s=>inShape(x,y,s)));
 const margin=radius+step*Math.SQRT2/2+5,marginY=radiusY+step*Math.SQRT2/2+5, cells=[];
 for(let iy=0;iy<rows;iy++)for(let ix=0;ix<cols;ix++){
  const x=origin[0]+ix*step,y=origin[1]+iy*step;
  if(!wet(x,y)||!greenFree(x,y,margin,marginY))continue;
  let safe=true;
  for(let i=0;i<24&&safe;i++){const a=i*Math.PI/12;safe=wet(x+Math.cos(a)*margin,y+Math.sin(a)*marginY);}
  if(!safe||relevant.some(s=>inShape(x,y,{...s,rx:s.rx+margin,ry:s.ry+marginY})))continue;
  cells.push(iy*cols+ix);
 }
 const record={island:p.island,id:p.id,source:p.source,duckies:pair,shapes:p.shapes,blockers:relevant,origin,cols,rows,step,radius,radiusY,cells};
 if(cells.length<8)throw Error(p.id+' has insufficient safe water: '+cells.length);
 out.push(record);console.log(p.island,p.id,cells.length,'radius',radius.toFixed(1));
}
fs.writeFileSync('src/pixi/pond-regions.json',JSON.stringify({version:1,gameZoom:.65,assets,excluded:{snow:'Frozen Lake Rink is ice; Aurora Run and Snowmelt Beck are rivers. Fountains, canals, sea and islets excluded.'},ponds:out})+'\n');
