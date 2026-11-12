import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const sharp=createRequire(import.meta.url)('sharp');
const root=fileURLToPath(new URL('../../',import.meta.url));
const art=JSON.parse(fs.readFileSync(root+'public/pixi-art/themes/bog-arena/art.json'));
const read=p=>fs.readFileSync(root+'public/'+p.replace(/^\//,''),'utf8');
function embed(p){let src=p.src.startsWith('/')?p.src:'pixi-art/themes/bog-arena/'+p.src;let s=read(src);const vb=s.match(/viewBox="([^"]+)"/)?.[1]??`0 0 ${p.width} ${p.height}`;let body=s.replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'');const a=p.anchor??{x:0,y:0};return `<svg x="${p.x-p.width*a.x}" y="${p.y-p.height*a.y}" width="${p.width}" height="${p.height}" viewBox="${vb}" overflow="visible">${body}</svg>`;}
const ground=read('pixi-art/themes/bog-arena/ground.svg').replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'');
let body=ground;
for(const p of [...art.flats,...art.decks])body+=embed(p);
for(const p of [...art.props].sort((a,b)=>a.y-b.y)){if(p.shadow){const [rx,ry]=p.shadowSize??[p.width*.3,10],[dx,dy]=p.shadowOffset??[0,-6];body+=`<ellipse cx="${p.x+dx}" cy="${p.y+dy}" rx="${rx}" ry="${ry}" fill="${art.shadowColor}" opacity="${art.shadowAlpha}"/>`;}body+=embed(p);}
if(!process.argv.includes('--plain')){const bs=JSON.parse(fs.readFileSync(root+'src/pixi/bog-blockers.json'));for(const b of bs.filter(b=>b.wallLayout||b.kind==='wall'||b.id.startsWith('lane-cover-')))body+=`<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="#ffdc70" fill-opacity=".42" stroke="#00f7ea" stroke-width="10"/>`;const l=JSON.parse(fs.readFileSync(root+'scripts/bog-environment/layout.json'));for(const g of l.wallLayout?.groups??[]){const p=art.props.find(p=>p.id===g.members[0]);body+=`<text x="${p.x}" y="${p.y-200}" text-anchor="middle" font-family="sans-serif" font-size="62" fill="#fff8dc" stroke="#302339" stroke-width="12" paint-order="stroke">${g.label.startsWith('privacy')||g.label.startsWith('google')?'Base':g.label}</text>`;}}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="1640" viewBox="0 0 8400 8200"><rect width="8400" height="8200" fill="${art.sea}"/>${body}</svg>`;
await sharp(Buffer.from(svg)).png().toFile(process.argv[2]??root+'layout-overview.png');
