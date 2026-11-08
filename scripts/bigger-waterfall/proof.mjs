import sharp from 'sharp';import fs from 'node:fs';import {render}from './render.mjs';import {inPoly}from '../../rive/web/island-geometry.mjs';
const OUT='../concepts/themes/world-map/bigger',plan=JSON.parse(fs.readFileSync('scripts/bigger-waterfall/plan.json')),old=JSON.parse(fs.readFileSync('scripts/bigger-waterfall/original/world.json'));
fs.mkdirSync(OUT+'/waterfall-proof',{recursive:true});
const summary=[];
for(const [id,x,y]of [['heart',3900,3800],['fern-lawn',1730,2600],['lagoon-lawn',6100,2600],['original-falls',3900,2100]]){
 const crop={x,y,k:.8,w:1440,h:1120},base=OUT+'/waterfall-proof/'+id+'-before.png',built=OUT+'/waterfall-proof/'+id+'-after.png';
 await render(base,crop,true);await render(built,crop);const a=await sharp(base).raw().ensureAlpha().toBuffer(),b=await sharp(built).raw().ensureAlpha().toBuffer();let protectedPixels=0,changed=0;
 for(let py=0;py<crop.h;py++)for(let px=0;px<crop.w;px++){const wx=x+(px-crop.w/2)/.8,wy=y+(py-crop.h/2)/.8;if(!inPoly(wx,wy,old.coast))continue;protectedPixels++;const i=(py*crop.w+px)*4;if(!a.subarray(i,i+4).equals(b.subarray(i,i+4)))changed++;}
 summary.push({id,scale:.8,protectedPixels,changed});
}
const oldArt=JSON.parse(fs.readFileSync('scripts/bigger-waterfall/original/art.json')),art=JSON.parse(fs.readFileSync('public/pixi-art/themes/waterfall/art.json'));
const bytes=a=>a.ground.tiles.reduce((n,t)=>n+Math.ceil(t.width*(t.resolution??1))*Math.ceil(t.height*(t.resolution??1))*4,0);
const area=coast=>Math.abs(coast.reduce((n,p,i)=>{const q=coast[(i+1)%coast.length];return n+p[0]*q[1]-q[0]*p[1]},0))/2;
const validation={originalPropsUnchanged:JSON.stringify(oldArt.props)===JSON.stringify(art.props.slice(0,oldArt.props.length)),originalFlatsUnchanged:JSON.stringify(oldArt.flats)===JSON.stringify(art.flats),originalDecksUnchanged:JSON.stringify(oldArt.decks)===JSON.stringify(art.decks.slice(0,oldArt.decks.length)),dryInteriorPixelCrops:summary,groundTexture:{beforeBytes:bytes(oldArt),afterBytes:bytes(art),beforeMiB:bytes(oldArt)/2**20,afterMiB:bytes(art)/2**20,maxTileWidth:Math.max(...art.ground.tiles.map(t=>t.width)),maxTileHeight:Math.max(...art.ground.tiles.map(t=>t.height))},landArea:{before:area(old.coast),after:area(plan.coast),ratio:area(plan.coast)/area(old.coast)}};
fs.writeFileSync(OUT+'/waterfall-proof/validation.json',JSON.stringify(validation,null,2));
const labels=['DRAWING / four working neighbourhoods','BUILT / production vector layers'];let composites=[];
for(const[i,name]of ['waterfall-communities.png','waterfall-built.png'].entries()){composites.push({input:OUT+'/'+name,left:i*1680,top:60});composites.push({input:Buffer.from(`<svg width="1680" height="60"><rect width="1680" height="60" fill="#FFF0C7"/><text x="24" y="39" font-family="Arial" font-size="24" fill="#39472D">${labels[i]}</text></svg>`),left:i*1680,top:0});}
await sharp({create:{width:3360,height:1356,channels:4,background:'#6EC9DE'}}).composite(composites).png().toFile(OUT+'/waterfall-vs-drawing.png');
let refs=[];for(const[i,file]of ['../concepts/themes/world-map/cursor-camp-paths-ref.jpg',OUT+'/waterfall-crops/junction.png',OUT+'/waterfall-crops/lane.png'].entries()){refs.push({input:await sharp(file).resize(1000,760,{fit:'contain',background:'#FFF0C7'}).png().toBuffer(),left:i*1000,top:60});refs.push({input:Buffer.from(`<svg width="1000" height="60"><rect width="1000" height="60" fill="#FFF0C7"/><text x="24" y="39" font-family="Arial" font-size="22" fill="#39472D">${['REFERENCE / look only','BUILT / sandy junction at 0.8 px/unit','BUILT / neighbourhood lane at 0.8 px/unit'][i]}</text></svg>`),left:i*1000,top:0});}
await sharp({create:{width:3000,height:820,channels:4,background:'#FFF0C7'}}).composite(refs).png().toFile(OUT+'/waterfall-paths-vs-reference.png');console.log(JSON.stringify(validation,null,2));
