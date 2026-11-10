// Offline vector crop, using the manifest's placement, anchor, scale and depth order.
// PNG evidence is written only outside the repository, under round3.
import fs from 'node:fs';
import sharp from 'sharp';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/round3/';
const before=process.argv.includes('--before');
const A='public/pixi-art/themes/community/';
const art=JSON.parse(fs.readFileSync(before?out+'stage-before-art.json':A+'art.json'));
const box=[3000,520,2000,1550],k=.8;
const overlaps=(x,y,w,h)=>x<box[0]+box[2]&&x+w>box[0]&&y<box[1]+box[3]&&y+h>box[1];
function piece(p,anchor={x:0,y:0}){
 const w=p.width*(p.scale??1),h=p.height*(p.scale??1),x=p.x-w*anchor.x,y=p.y-h*anchor.y;
 if(!overlaps(x,y,w,h))return '';
 const file=before&&p.id==='events-stage'?out+'stage-before-stage.svg':p.src.startsWith('/')?'public'+p.src:A+p.src;
 let s=fs.readFileSync(file,'utf8').replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>/g,'');
 const root=s.match(/<svg\b[^>]*>/)[0],vb=root.match(/viewBox="([^"]+)"/)?.[1]??`0 0 ${p.width} ${p.height}`;
 const inner=s.slice(s.indexOf(root)+root.length,s.lastIndexOf('</svg>'));
 return `<g transform="translate(${p.flip?x+w:x} ${y})${p.flip?' scale(-1 1)':''}"><svg width="${w}" height="${h}" viewBox="${vb}" preserveAspectRatio="none">${inner}</svg></g>`;
}
let parts=[];
for(const p of art.ground.tiles)parts.push(piece(p));
for(const p of art.flats)parts.push(piece(p,p.topLeft?{x:0,y:0}:{x:.5,y:1}));
for(const p of art.decks)parts.push(piece(p));
for(const p of [...art.props].sort((a,b)=>(a.sortY??a.y)-(b.sortY??b.y)))parts.push(piece(p,p.anchor??{x:.5,y:1}));
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${box[2]*k}" height="${box[3]*k}" viewBox="${box.join(' ')}"><rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="#94b832"/>${parts.join('')}</svg>`;
await sharp(Buffer.from(svg)).png().toFile(out+`stage-${before?'before':'after'}.png`);
console.log(`Rendered ${before?'before':'after'} crop in round3`);
