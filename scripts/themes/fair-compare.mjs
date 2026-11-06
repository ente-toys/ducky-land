// Offline visual proof, not a browser screenshot. Both maps use identical pixels/world-unit.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import sharp from 'sharp';
import {render} from './fair-render.mjs';
const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair/';mkdirSync(OUT,{recursive:true});
const fair=JSON.parse(readFileSync('public/pixi-art/themes/fair/art.json')),home=JSON.parse(readFileSync(OUT+'home-reference.json'));
const round=process.env.ROUND||'final';
const label=(text,w,h=36)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#fff5d7"/><text x="16" y="24" fill="#39472d" font-family="sans-serif" font-size="16">${text}</text></svg>`);
const W=1820,H=1220,k=.25;
const a=await render(home,{home:true,k,x:-740,y:-240,width:W,height:H}),b=await render(fair,{k,width:W,height:H});
await sharp({create:{width:W*2,height:H+36,channels:4,background:'#fff5d7'}}).composite([{input:a,left:0,top:36},{input:b,left:W,top:36},{input:label('HOME | source SVG render | 0.25 pixels / world unit',W),left:0,top:0},{input:label('FAIR | source SVG render | 0.25 pixels / world unit',W),left:W,top:0}]).png().toFile(OUT+(round==='final'?'':round+'-')+'fair-vs-home.png');
const views=[['Plaza',[2820,2370],[3570,2738]],['Curved bench ring',[2890,2660],[3895,3105]],['Path junction',[2280,2290],[2680,2650]],['Tree cluster',[3530,3040],[2260,2070]]];
const cw=900,ch=570,ck=.6,comps=[];
for(const [i,[name,h,f]]of views.entries())for(const [col,[art,pt,isHome]]of [[home,h,true],[fair,f,false]].entries()){
 const pic=await render(art,{home:isHome,k:ck,x:pt[0]-cw/ck/2,y:pt[1]-ch/ck/2,width:cw,height:ch});
 comps.push({input:pic,left:col*cw,top:i*(ch+36)+36},{input:label((isHome?'HOME':'FAIR')+' | '+name+' | 0.6 pixels / world unit',cw),left:col*cw,top:i*(ch+36)});
}
await sharp({create:{width:cw*2,height:(ch+36)*views.length,channels:4,background:'#fff5d7'}}).composite(comps).png().toFile(OUT+(round==='final'?'':round+'-')+'fair-closeups-vs-home.png');
console.log('Saved',round,'whole and closeup comparisons under',OUT);
