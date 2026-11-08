import sharp from 'sharp';
import {readFileSync,writeFileSync} from 'node:fs';
import {render,OUT,A} from './render.mjs';
import {places} from './design.mjs';
import {inPoly} from '../../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(readFileSync(p)),art=read(A+'art.json'),old=read('scripts/bigger-sunflower/baseline/art.json'),world=read('scripts/bigger-sunflower/baseline/world.json');
await render(art,OUT+'/sunflower-built.png');
const communityCrops={
 pollenpatch:{x:650,y:-300,k:.8,w:2400,h:1200},
 hayhello:{x:4750,y:-450,k:.8,w:2800,h:1280},
 whirlyseed:{x:7700,y:1200,k:.8,w:1440,h:2560},
 petalpost:{x:2500,y:5100,k:.8,w:2560,h:1440},
 seedwake:{x:-1550,y:1550,k:.8,w:1440,h:2400},
};
for(const p of places){await render(art,OUT+`/sunflower-ground-crops/${p.id}.png`,communityCrops[p.id]);}
await render(art,OUT+'/sunflower-ground-crops/road-junction.png',{x:2520,y:-200,k:.8,w:1120,h:880});
await render(art,OUT+'/sunflower-ground-crops/lane.png',{x:900,y:0,k:.8,w:1120,h:880});
await render(art,OUT+'/sunflower-ground-crops/open-meadow.png',{x:-600,y:1300,k:.8,w:1120,h:880});
await render(art,OUT+'/sunflower-ground-crops/coast-walk.png',{x:2100,y:5400,k:.8,w:1120,h:880});
const parts=[];for(const [i,file]of ['sunflower-communities.png','sunflower-built.png'].entries()){parts.push({input:OUT+'/'+file,left:i*1680,top:50});parts.push({input:Buffer.from(`<svg width="1680" height="50"><rect width="1680" height="50" fill="#FFF0C7"/><text x="24" y="33" font-family="Arial" font-size="23" fill="#39472D">${i?'BUILT / production SVG artwork':'DRAWING / authored farm composition'}</text></svg>`),left:i*1680,top:0});}
await sharp({create:{width:3360,height:1226,channels:4,background:art.sea}}).composite(parts).png().toFile(OUT+'/sunflower-vs-drawing.png');
const roadParts=[
 {input:OUT+'/../cursor-camp-paths-ref.jpg',left:0,top:60},
 {input:OUT+'/sunflower-ground-crops/road-junction.png',left:800,top:60},
 {input:OUT+'/sunflower-ground-crops/lane.png',left:1920,top:60},
 ...[['REFERENCE / study only',0,800],['SUNFLOWER / junction at 0.8 px per unit',800,1120],['SUNFLOWER / lane at 0.8 px per unit',1920,1120]].map(([text,x,w])=>({input:Buffer.from(`<svg width="${w}" height="60"><text x="20" y="38" font-family="Arial" font-size="22" fill="#39472D">${text}</text></svg>`),left:x,top:0}))
];
await sharp({create:{width:3040,height:940,channels:4,background:'#FFF0C7'}}).composite(roadParts).png().toFile(OUT+'/sunflower-paths-vs-reference.png');
// Compare real assembled pixels, without copying original pixels back over the result.
const cam={x:0,y:0,k:.25,w:2000,h:1400};await render(old,OUT+'/sunflower-work/original-pixel-frame.png',cam,true);await render(art,OUT+'/sunflower-work/built-pixel-frame.png',cam,true);
const before=await sharp(OUT+'/sunflower-work/original-pixel-frame.png').ensureAlpha().raw().toBuffer(),after=await sharp(OUT+'/sunflower-work/built-pixel-frame.png').ensureAlpha().raw().toBuffer();
let tested=0,changed=0;const examples=[];
for(let y=0;y<cam.h;y++)for(let x=0;x<cam.w;x++){const j=(y*cam.w+x)*4,wx=x/cam.k,wy=y/cam.k;
 const interior=inPoly(wx,wy,world.coast)||world.islets.some(([cx,cy,rx,ry])=>((wx-cx)/(rx-10))**2+((wy-cy)/(ry-10))**2<1);
 if(interior&&before[j+3]===255){tested++;if(!before.subarray(j,j+4).equals(after.subarray(j,j+4))){changed++;if(examples.length<30)examples.push([wx,wy,...before.subarray(j,j+4),...after.subarray(j,j+4)])}}
}
const texture=async a=>{let bytes=0,fileBytes=0;for(const t of a.ground.tiles){const m=await sharp(A+t.src).metadata();bytes+=m.width*m.height*4*(t.resolution??1)**2;fileBytes+=readFileSync(A+t.src).length;}return {tiles:a.ground.tiles.length,decodedMiB:bytes/1048576,svgMiB:fileBytes/1048576,maxSourceDimension:Math.max(...await Promise.all(a.ground.tiles.map(async t=>{const m=await sharp(A+t.src).metadata();return Math.max(m.width,m.height)})))};};
const report={renderer:'Production SVG assembly with sharp; excludes live players, live animation and runtime shadows',overviewPixelsPerUnit:.14,cropsPixelsPerUnit:.8,crops:places.map(p=>p.id).concat(['road-junction','lane','open-meadow','coast-walk']),preservation:{fullyOpaqueInteriorPixels:tested,changedPixels:changed,examples},ground:{before:await texture(old),after:await texture(art)}};
writeFileSync(OUT+'/sunflower-work/proof.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
