import sharp from 'sharp';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {geometry} from '../../assets/world/island-geometry.mjs';
import {mapOf} from '../../src/world/island-maps.js';
const root=process.cwd();
const bundle=await build({entryPoints:[root+'/src/world/home/placements.js'],bundle:true,platform:'node',format:'esm',write:false});
const P=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
export function homeLayers(){
 const world=P.trimWorld(mapOf('home').world),props=P.createPlacements(world,geometry({...world,obstacles:[]}).walkable);
 return {tiles:P.HOME_TILES,flats:[{src:'/pixi-art/lake-race.svg',x:3400,y:1050,width:1500,height:950,topLeft:true},{src:'/pixi-art/decals/plaza-paving.svg',x:2330,y:1980,width:980,height:780,topLeft:true},...P.homeDecals(props)],decks:[...P.HOME_DECKS,...P.JETTIES],props};
}
export async function snapshot(island,{groundOnly=false}={}){
  const m=mapOf(island.id),K=1024/Math.max(m.width,m.height),W=Math.round(m.width*K),H=Math.round(m.height*K),layers=[];
  const source=s=>s.startsWith('/pixi-art/')?root+'/public'+s:s.startsWith('/assets/')?root+s:path.isAbsolute(s)?s:root+'/'+s;
  async function add(p,kind,base=''){
   const scale=kind==='prop'?(p.scale??1):1,w=Math.max(1,Math.round(p.width*scale*K)),h=Math.max(1,Math.round(p.height*scale*K));
   const a=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};
   const x=Math.round((p.x-m.origin.x)*K-a.x*w),y=Math.round((p.y-m.origin.y)*K-a.y*h);
   if(x>=W||y>=H||x+w<=0||y+h<=0)return;
   const src=p.src.startsWith('/')?source(p.src):base+p.src;
   let im=sharp(src).resize(w,h,{fit:'fill'});if(p.flip)im=im.flop();
   const left=Math.max(0,x),top=Math.max(0,y),cw=Math.min(w-Math.max(0,-x),W-left),ch=Math.min(h-Math.max(0,-y),H-top);
   const input=await im.png().toBuffer();
   layers.push({input:cw===w&&ch===h?input:await sharp(input).extract({left:Math.max(0,-x),top:Math.max(0,-y),width:cw,height:ch}).toBuffer(),left,top});
  }
  if(m.home){
   const world=P.trimWorld(m.world),props=P.createPlacements(world,geometry({...world,obstacles:[]}).walkable);
   for(const p of P.HOME_TILES)await add(p,'ground');
   if(!groundOnly){
   for(const p of [{src:'/pixi-art/lake-race.svg',x:3400,y:1050,width:1500,height:950,topLeft:true},{src:'/pixi-art/decals/plaza-paving.svg',x:2330,y:1980,width:980,height:780,topLeft:true},...P.homeDecals(props)])await add(p,'flat');
   for(const p of [...P.HOME_DECKS,...P.JETTIES])await add(p,'deck');
   for(const p of props.sort((a,b)=>a.y-b.y))await add(p,'prop');
   }
  }else{
   const base=`${root}/public/pixi-art/themes/${m.id}/`,art=JSON.parse(readFileSync(base+'art.json'));
   for(const p of art.ground.tiles)await add(p,'ground',base);
   if(!groundOnly){
   for(const p of art.floating??[])await add({...p,topLeft:true,x:p.x-p.width/2,y:p.y-p.height/2},'flat',base);
   for(const p of art.flats??[])await add(p,'flat',base);
   for(const p of art.decks??[])await add(p,'deck',base);
   for(const p of [...art.props].sort((a,b)=>a.y-b.y))await add(p,'prop',base);
   }
  }
  return sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toBuffer();
 }
export function homeArtwork(){
 const w=P.trimWorld(mapOf('home').world),props=P.createPlacements(w,geometry({...w,obstacles:[]}).walkable);
 return [...props,...P.HOME_TILES.map(p=>({...p,kind:'ground'})),...P.HOME_DECKS,...P.JETTIES,
 ...P.homeDecals(props).map(p=>({...p,resolution:2.5})),
 {src:'/pixi-art/lake-race.svg',width:1500,height:950,resolution:1},
 {src:'/pixi-art/decals/plaza-paving.svg',width:980,height:780,resolution:1},
 ...JSON.parse(readFileSync('src/world/home/art-manifest.json')).floating];
}
