import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render.mjs';
export const A='public/pixi-art/themes/cathedral/';
export const GRASS_COLORS=new Set(['162,181,66','170,188,80','178,200,85','194,210,118']);
export const SWATCH=[[24,28,0],[153,74,1],[294,22,2],[447,93,3],[550,18,1],[77,160,2],[220,194,0],[371,151,1],[512,213,2],[17,306,1],[162,337,3],[296,284,2],[430,350,0],[563,313,1],[352,238,3],[102,251,0]];
const strip=s=>s.replace(/<g data-bellovo-grass="r2">[\s\S]*?<\/g><!--bellovo-grass-end-->/g,'');
const X=-2200,Y=-2400,k=.25,W=3200,H=2600;
const sizes=[[44,26,1.45],[34,22,1.5],[56,24,1.2],[44,26,1.05]];
const bodyCache=new Map();
function homeSvg(file,x,y,w,h,amber=false){
 let src=bodyCache.get(file);
 if(!src){src=fs.readFileSync(`public/pixi-art/decals/${file}.svg`,'utf8');bodyCache.set(file,src);}
 const box=src.match(/viewBox="([^"]+)"/)[1];
 let body=src.slice(src.indexOf('>')+1,src.lastIndexOf('</svg>'));
 if(amber)body=body.replaceAll('#4AA539','#b28a37').replaceAll('#2B7A37','#826530').replaceAll('#89C332','#dfb552');
 return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${box}" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
export function markBody(x,y,kind,amber){const [w,h,s]=sizes[kind];return homeSvg(`grass-tuft-${kind===2?3:kind===1?2:1}`,x,y,+(w*s).toFixed(1),+(h*s).toFixed(1),amber);}
function rectGood(data,x,y,w,h){
 const x0=Math.floor((x-X-5)*k),x1=Math.ceil((x+w-X+5)*k),y0=Math.floor((y-Y-5)*k),y1=Math.ceil((y+h-Y+5)*k);
 if(x0<0||y0<0||x1>=W||y1>=H)return false;
 for(let iy=y0;iy<=y1;iy++)for(let ix=x0;ix<=x1;ix++){const i=(iy*W+ix)*4;if(data[i+3]!==255||!GRASS_COLORS.has(`${data[i]},${data[i+1]},${data[i+2]}`))return false;}
 return true;
}
function patchBody(p){
 const {x,y,width:w,height:h}=p;
 const shape=(a,b,c,d)=>`M${a+c*.08} ${b+d*.51}C${a-c*.08} ${b+d*.12} ${a+c*.29} ${b-d*.07} ${a+c*.53} ${b+d*.07}C${a+c*.8} ${b-d*.04} ${a+c*1.06} ${b+d*.28} ${a+c*.93} ${b+d*.63}C${a+c*.82} ${b+d*1.02} ${a+c*.59} ${b+d*.8} ${a+c*.38} ${b+d*.94}C${a+c*.12} ${b+d*1.05} ${a-c*.04} ${b+d*.75} ${a+c*.08} ${b+d*.51}Z`;
 return `<path d="${shape(x+12,y+8,w-24,h-16)}" fill="#6d9236" opacity=".07"/><path d="${shape(x+26,y+18,w-52,h-36)}" fill="#6d9236" opacity=".09"/>`;
}
function leafBody(p){const {x,y,amber}=p,c=amber?'#b77c3d':'#c6a64b';return `<path d="M${x+2} ${y+10}Q${x+8} ${y+1} ${x+19} ${y+4}Q${x+16} ${y+14} ${x+2} ${y+10}Z" fill="${c}"/><path d="M${x+4} ${y+10}l12 -5" fill="none" stroke="#947443" stroke-width="1" stroke-linecap="round"/>`;}
function packSymbols(fragment){
 const symbols=new Map();
 const body=fragment.replace(/<svg x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/g,(_,x,y,w,h,box,paths)=>{
  const key=box+paths;
  if(!symbols.has(key))symbols.set(key,{id:`lawn-${symbols.size}`,box,paths});
  return `<use href="#${symbols.get(key).id}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
 });
 return `<defs>${[...symbols.values()].map(s=>`<symbol id="${s.id}" viewBox="${s.box}" fill="none" stroke-linecap="round" stroke-linejoin="round">${s.paths}</symbol>`).join('')}</defs>`+body;
}
export async function applyGrass(){
 const art=JSON.parse(fs.readFileSync(A+'art.json'));
 const tiles=art.ground.tiles.filter(t=>t.src.startsWith('communities/'));
 const sources=new Map(tiles.map(t=>[t.src,strip(fs.readFileSync(A+t.src,'utf8'))]));
 for(const t of tiles)fs.writeFileSync(A+t.src,sources.get(t.src));
 const buildings=art.props.filter(p=>p.door||p.id==='cathedral-hall'||p.id==='campanile'||/colonnade|gazebo|arbour|olive-mill/.test(p.id??''));
 const floor={...art,props:buildings,floating:[],flats:art.flats.filter(p=>!/shadow|litter/.test(p.id??''))};
 const {data}=await sharp(await render(floor,{x:X,y:Y,k,width:W,height:H})).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const features=[];
 function admit(p){if(rectGood(data,p.x,p.y,Math.max(32,p.width),Math.max(19,p.height)))features.push(p);}
 for(let row=0;row<27;row++)for(let col=0;col<22;col++){
  const bx=X+col*600+(row%2?79:0),by=Y+row*400;
  for(const [i,[dx,dy,kind]] of SWATCH.entries()){
   const [w,h,s]=sizes[kind];admit({x:bx+dx,y:by+dy,kind,amber:(col*3+row+i)%9===0,width:+(w*s).toFixed(1),height:+(h*s).toFixed(1),type:'tuft'});
  }
  for(const [i,[dx,dy]]of [[109,111],[321,115],[471,274],[236,366]].entries()){
   const file=['flower-dot-1','flower-dot-3','flower-dot-2'][i%3],dims=file==='flower-dot-1'?[20,18]:file==='flower-dot-3'?[22,16]:[26,18];
   admit({x:bx+dx,y:by+dy,width:dims[0]*1.25,height:dims[1]*1.25,type:'flower',file});
  }
  for(const [i,[dx,dy]]of [[188,134],[397,303],[52,365]].entries())admit({x:bx+dx,y:by+dy,width:22,height:16,type:'leaf',amber:(row+col+i)%2===0});
 }
 for(let row=0;row<28;row++)for(let col=0;col<25;col++){
  const width=[190,290,360][(row+col)%3],height=[110,160,210][(row*2+col)%3];
  admit({x:X+col*530+(row%2?190:90),y:Y+row*390+65,width,height,type:'patch'});
 }
 const order={patch:0,tuft:1,flower:2,leaf:3};features.sort((a,b)=>order[a.type]-order[b.type]);
 const perTile={},used=new Map();
 for(const t of tiles){
  const source=sources.get(t.src),view=source.match(/viewBox="([^"]+)"/)[1].split(/[ ,]+/).map(Number),[vx,vy,vw,vh]=view;
  const local=features.filter(p=>p.x+p.width>=t.x&&p.x<=t.x+t.width&&p.y+p.height>=t.y&&p.y<=t.y+t.height);
  if(Math.abs(vx-t.x)>4||Math.abs(vy-t.y)>4||Math.abs(vw-t.width)>8||Math.abs(vh-t.height)>8)throw Error('unexpected tile frame '+t.src);
  const fragment=local.map(p=>{used.set(`${p.type}:${p.x},${p.y}`,p);return p.type==='tuft'?markBody(p.x,p.y,p.kind,p.amber):p.type==='flower'?homeSvg(p.file,p.x,p.y,p.width,p.height):p.type==='leaf'?leafBody(p):patchBody(p);}).join('');
  fs.writeFileSync(A+t.src,source.replace('</svg>',`<g data-bellovo-grass="r2">${packSymbols(fragment)}</g><!--bellovo-grass-end--></svg>`));perTile[t.src]=local.length;
 }
 const all=[...used.values()],marks=all.filter(p=>p.type==='tuft');
 fs.writeFileSync('scripts/bigger-cathedral/round2-grass.json',JSON.stringify({method:'Home original grass fan SVGs at Home scale; full feature bounds plus five-unit margin admitted against painted lawn and building silhouettes; baked across tile seams',colors:[...GRASS_COLORS],marks,features:all.filter(p=>p.type!=='tuft'),perTile},null,2)+'\n');
 console.log('Lawn detail:',Object.fromEntries(Object.keys(order).map(type=>[type,all.filter(p=>p.type===type).length])),`${tiles.length} existing tiles; no new sprites.`);
}
if(process.argv[1]?.endsWith('/round2-grass.mjs'))await applyGrass();
