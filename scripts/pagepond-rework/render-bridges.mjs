import fs from 'node:fs';
import sharp from 'sharp';
import {render} from '../pagepond/render.mjs';
import {checkTheme} from '../theme-index.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),out=process.env.PAGEPOND_BRIDGE_OUT??'artifacts/pagepond-bridges',art=read('public/pixi-art/themes/library/art.json'),world=read('rive/web/themes/library/world.json'),harbor=read('rive/web/themes/library/harbor.json'),beds=checkTheme('library').sleepers;
fs.mkdirSync(out,{recursive:true});
const names=['centre-north-EW','centre-south-EW','west-jetty','east-jetty','south-jetty','reading-dock'];
const views=world.walkways.map((w,i)=>({id:w.id??names[i],a:w.a,b:w.b,kind:i<2||w.id?.startsWith('bridge-')?'bridge':'pier'}));
const j=harbor.jetty;art.decks.push({src:'/pixi-art/bridge-jetty-1.svg',x:j.foot[0]-j.width/2,y:j.foot[1]-16,width:j.width,height:j.tip[1]-j.foot[1]+32});
views.push({id:'harbor-pier',a:j.foot,b:j.tip,kind:'pier'});
const thumbs=[];const tw=600,th=480,cols=4;
for(const [i,v]of views.entries()){
 const x=(v.a[0]+v.b[0])/2,y=(v.a[1]+v.b[1])/2,width=Math.max(1300,Math.abs(v.a[0]-v.b[0])+720),height=Math.max(1050,Math.abs(v.a[1]-v.b[1])+650),file=out+'/'+v.id+'.png';
 await render(art,[x-width/2,y-height/2-60,width,height],.8,file,{beds,boats:v.id==='harbor-pier'?harbor.boats:[]});
 const pic=await sharp(file).resize(tw,th-38,{fit:'contain',background:'#6ec7d9'}).png().toBuffer(),label=Buffer.from(`<svg width="${tw}" height="38"><rect width="${tw}" height="38" fill="#fff0c7"/><text x="15" y="26" font-family="Arial" font-size="19" fill="#39472d">${v.id} (${v.kind})</text></svg>`);
 thumbs.push({input:pic,left:(i%cols)*tw,top:Math.floor(i/cols)*th+38},{input:label,left:(i%cols)*tw,top:Math.floor(i/cols)*th});
}
await sharp({create:{width:cols*tw,height:Math.ceil(views.length/cols)*th,channels:4,background:'#6ec7d9'}}).composite(thumbs).png().toFile(out+'/all.png');
fs.writeFileSync(out+'/views.json',JSON.stringify(views,null,2)+'\n');
console.log(JSON.stringify({bridges:views.filter(v=>v.kind==='bridge').length,piers:views.filter(v=>v.kind==='pier').length,views:views.length,out}));
