import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {mapFor} from '../src/pixi/island-maps.js';

// Sample the current source sprites directly. No screenshot baseline or local
// external file is required, so island rebuilds keep their own reference art.
async function sourcePatch(theme,cx,cy,{props=false}={}){
 const map=mapFor(theme),K=1024/Math.max(map.width,map.height),base=`public/pixi-art/themes/${theme}/`,art=JSON.parse(fs.readFileSync(base+'art.json'));
 const entries=[...art.ground.tiles.map(p=>[p,'tile']),...(art.floating??[]).map(p=>[{...p,x:p.x-p.width/2,y:p.y-p.height/2,topLeft:true},'flat']),...(art.flats??[]).map(p=>[p,'flat']),...(art.decks??[]).map(p=>[p,'deck']),...[...(props?art.props:art.props.filter(p=>p.deck||/bridge|jetty|boardwalk/i.test(p.src+' '+p.name)))].sort((a,b)=>a.y-b.y).map(p=>[p,'prop'])];
 const pixels=Array.from({length:9},()=>[0,0,0,0]);
 for(const [p,kind]of entries){const scale=kind==='prop'?(p.scale??1):1,w=Math.max(1,Math.round(p.width*scale*K)),h=Math.max(1,Math.round(p.height*scale*K)),anchor=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0},x=Math.round((p.x-map.origin.x)*K-anchor.x*w),y=Math.round((p.y-map.origin.y)*K-anchor.y*h);
  if(cx+1<x||cx-1>=x+w||cy+1<y||cy-1>=y+h)continue;
  const file=p.src.startsWith('/')?'public'+p.src:base+p.src;let image=sharp(file).resize(w,h,{fit:'fill'});if(p.flip)image=image.flop();const bytes=await image.ensureAlpha().raw().toBuffer();
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const sx=cx+dx-x,sy=cy+dy-y;if(sx<0||sy<0||sx>=w||sy>=h)continue;const i=(sy*w+sx)*4,a=bytes[i+3]/255,out=pixels[(dy+1)*3+dx+1],alpha=a+out[3]*(1-a);for(let c=0;c<3;c++)out[c]=alpha?(bytes[i+c]*a+out[c]*out[3]*(1-a))/alpha:0;out[3]=alpha;}
 }
 return pixels.map(p=>[...p.slice(0,3),p[3]*255]);
}
async function outputPatch(theme,cx,cy,ground){const {data,info}=await sharp(`public/pixi-art/globe/${theme}${ground?'-ground':''}.svg`).ensureAlpha().raw().toBuffer({resolveWithObject:true});const out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const i=((cy+dy)*info.width+cx+dx)*4;out.push([...data.subarray(i,i+4)]);}return out;}
const average=p=>[0,1,2,3].map(c=>p.reduce((sum,v)=>sum+(c<3?v[c]*v[3]/255:v[c]),0)/p.length);
async function compare(theme,x,y,ground){const [source,output]=await Promise.all([sourcePatch(theme,x,y,{props:!ground}),outputPatch(theme,x,y,ground)]),a=average(source),b=average(output);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<85),`${theme} ${x},${y}: source ${a.map(Math.round)} -> compiled ${b.map(Math.round)}`);}

test('Fair paving keeps its source tile order above older grass backgrounds',async()=>{
 await compare('fair',700,350,true);
 await compare('fair',550,450,true);
});
test('Pink houses retain source colour instead of solid black fallback paint',async()=>{
 const map=mapFor('pink'),K=1024/Math.max(map.width,map.height),art=JSON.parse(fs.readFileSync('public/pixi-art/themes/pink/art.json'));
 const homes=art.props.filter(p=>/house|cottage|cafe/i.test(p.src+' '+p.name)&&p.width*(p.scale??1)*K>16).slice(0,4);assert.ok(homes.length>=3);
 for(const p of homes){const scale=p.scale??1,w=p.width*scale,h=p.height*scale,a=p.anchor??{x:.5,y:1};await compare('pink',Math.round((p.x-a.x*w+w*.5-map.origin.x)*K),Math.round((p.y-a.y*h+h*.4-map.origin.y)*K),false);}
});
