import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {original,plan,out} from './design.mjs';
import {terrainSVG,bridgeArt} from './terrain.mjs';
const mode=process.argv[2]??'concept';
export async function render(art,file,{x=plan.origin.x,y=plan.origin.y,w=plan.width,h=plan.height,k=.12,labels=false}={}){
 const W=Math.round(w*k),H=Math.round(h*k),layers=[],cache=new Map();
 async function add(p,kind){let s=p.scale??1,pw=Math.max(1,Math.round(p.width*s*k)),ph=Math.max(1,Math.round(p.height*s*k)),anchor=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0},left=Math.round((p.x-x)*k-pw*anchor.x),top=Math.round((p.y-y)*k-ph*anchor.y);if(left>=W||top>=H||left+pw<=0||top+ph<=0)return;let src=p.src.startsWith('/')?'public'+p.src:'public/pixi-art/themes/bog/'+p.src,key=src+pw+':'+ph+':'+p.flip,buf=cache.get(key);if(!buf){let im=sharp(src).resize(pw,ph,{fit:'fill'});if(p.flip)im=im.flop();buf=await im.png().toBuffer();cache.set(key,buf);}let l=Math.max(0,left),t=Math.max(0,top),sw=Math.min(pw-Math.max(0,-left),W-l),sh=Math.min(ph-Math.max(0,-top),H-t);layers.push({input:sw===pw&&sh===ph?buf:await sharp(buf).extract({left:Math.max(0,-left),top:Math.max(0,-top),width:sw,height:sh}).png().toBuffer(),left:l,top:t});}
 if(mode==='concept')layers.push({input:await sharp(Buffer.from(terrainSVG(x,y,w,h))).resize(W,H).png().toBuffer(),left:0,top:0});
 for(const p of art.ground.tiles)await add(p,'ground');
 for(const p of art.flats??[])await add(p,'flat');
 for(const p of art.decks??[])await add(p,'deck');
 for(const p of [...art.props].sort((a,b)=>a.y-b.y))await add(p,'prop');
 let result=sharp({create:{width:W,height:H,channels:4,background:art.sea}}).composite(layers);let buf=await result.png().toBuffer();
 if(labels){let text=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>text{font-family:Arial,sans-serif;fill:#39472D;font-weight:bold}.small{font-size:15px}</style>`;for(const c of plan.communities){let px=(c.point[0]-x)*k,py=(c.point[1]-y)*k+95;text+=`<rect x="${px-128}" y="${py-23}" width="256" height="51" rx="9" fill="#F0E1B4" stroke="#39472D" stroke-width="2"/><text x="${px}" y="${py-1}" text-anchor="middle" font-size="21">${c.name}</text><text class="small" x="${px}" y="${py+19}" text-anchor="middle">${c.who.split(' and ')[0]}</text>`;}text+=`<text x="${W/2}" y="${H-40}" text-anchor="middle" font-size="26">BOOQUACK BOG · COMMUNITY PLAN</text><text x="${W/2}" y="${H-16}" text-anchor="middle" font-size="16">Boo Boxing Ring + Crookbill Manor stay as the heart. Worn roads, shared greens, two brooks.</text></svg>`;buf=await sharp(buf).composite([{input:Buffer.from(text)}]).png().toBuffer();}
 await sharp(buf).toFile(file);return buf;
}
if(process.argv[1]?.endsWith('/render.mjs')&&mode==='concept'){
 await render({...original.art,decks:[...original.art.decks,...bridgeArt],props:[...original.art.props,...plan.props]},out+'/bog-communities.png',{labels:true});
 await render(original.art,out+'/bog-now.png',{x:0,y:0,w:8000,h:6000,k:.18});
 console.log('Concept saved before changing production data.');
}else if(process.argv[1]?.endsWith('/render.mjs')){
 const art=JSON.parse(readFileSync('public/pixi-art/themes/bog/art.json'));
 await render(art,out+'/bog-built.png');
 for(const c of plan.communities)await render(art,out+'/bog-ground-crops/'+c.id+'.png',{x:c.crop[0]-1450,y:c.crop[1]-1100,w:2900,h:2200,k:.8});
 for(const [id,cx,cy,w,h]of [['road-junction',3950,6250,1700,1250],['lane',-250,-200,1700,1250],['west-commons',-800,3500,1700,1250],['river-crossing',2150,-350,1700,1250]])await render(art,out+'/bog-ground-crops/'+id+'.png',{x:cx-w/2,y:cy-h/2,w,h,k:.8});
 const before=await sharp(out+'/bog-communities.png').metadata(),after=await sharp(out+'/bog-built.png').metadata();await sharp({create:{width:before.width*2,height:before.height,channels:4,background:art.sea}}).composite([{input:out+'/bog-communities.png',left:0,top:0},{input:out+'/bog-built.png',left:before.width,top:0}]).png().toFile(out+'/bog-vs-drawing.png');
 console.log('Built overview and 8 crops rendered from production art at 0.8 px/unit.');
}
