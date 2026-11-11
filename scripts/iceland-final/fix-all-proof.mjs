import fs from 'node:fs';import path from 'node:path';import sharp from 'sharp';
import {integrate,ROOT,ART,bounds,overlaps} from './place.mjs';
const result=await integrate(),{art,world,files}=result;
const raw=src=>files.get(path.join(ART,src))??fs.readFileSync(path.join(ROOT,ART,src),'utf8');
const poses=JSON.parse(fs.readFileSync('src/pixi/sleep-poses.json'));
const sleepers=[];
for(const s of art.icelandFinal.sleepers){const pose=poses.poses[s.pose],u=pose.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=pose.box;for(const l of pose.layers){const svg=fs.readFileSync('public'+l.src,'utf8'),m=await sharp(Buffer.from(svg)).metadata(),width=m.width/poses.F*u,height=m.height/poses.F*u;sleepers.push({id:s.pose,src:l.src,x:s.x,y:s.y,width,height,anchor:{x:(x0+x1)/2*u/width,y:y1*u/height},svg,z:s.y+.01});}}
const part=p=>{const b=bounds(p);let source=p.svg??raw(p.src);source=source.replace(/width="[^"]+" height="[^"]+"/,`width="${p.width}" height="${p.height}"`);return `<g transform="translate(${b.x0} ${b.y0})">${p.flip?`<g transform="translate(${p.width} 0) scale(-1 1)">`:''}${source}${p.flip?'</g>':''}</g>`;};
const panels=[];
for(const [i,[name,cx,cy]]of [['cocoa hut',6200,4580],['sled',4500,2200],['snowman B',2550,7750],['cocoa garden',4960,7900],['workshop',2850,6480],['harbour',8980,7100]].entries()){
 const width=1440,height=1050,x=cx-width/2,y=cy-height/2,view={x0:x,y0:y,x1:x+width,y1:y+height};
 const scene=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="550"><rect width="720" height="550" fill="#fbf8ff"/><text x="20" y="22" font-size="18">${name}</text><svg y="25" width="720" height="525" viewBox="${x} ${y} ${width} ${height}">${raw(art.ground.vector)}${art.flats.filter(p=>overlaps(bounds(p),view)).map(part).join('')}${[...art.props.filter(p=>p.finalKind!=='smoke'),...sleepers].filter(p=>overlaps(bounds(p),view)).sort((a,b)=>(a.z??a.sortY??a.y)-(b.z??b.sortY??b.y)).map(part).join('')}</svg></svg>`;
 panels.push({input:await sharp(Buffer.from(scene)).png().toBuffer(),left:i%2*720,top:Math.floor(i/2)*550});
}
await sharp({create:{width:1440,height:1650,channels:4,background:'#fbf8ff'}}).composite(panels).png().toFile('/tmp/fa-proof.png');
fs.writeFileSync('/tmp/fa-art.json',JSON.stringify(art));fs.writeFileSync('/tmp/fa-world.json',JSON.stringify(world));console.log('/tmp/fa-proof.png');
