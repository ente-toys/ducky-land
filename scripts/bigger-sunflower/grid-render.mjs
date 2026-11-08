// Measuring aid (places nothing): a static render with a 250-unit world grid, and optional outlines (a JSON list of polygons).
// node scripts/bigger-sunflower/grid-render.mjs x0 y0 k width height out.png [polygons.json]
const R='../../';
const {render}=await import('./render.mjs');const {readFileSync}=await import('node:fs');
const sharp=(await import('sharp')).default;
const art=JSON.parse(readFileSync('public/pixi-art/themes/sunflower/art.json'));
const [x0,y0,k,W,H,out,extra]=[+process.argv[2],+process.argv[3],+process.argv[4],+process.argv[5],+process.argv[6],process.argv[7],process.argv[8]];
await render(art,out,{x:x0,y:y0,k,w:W,h:H});
let s=`<svg width="${W}" height="${H}">`;for(let gx=Math.ceil(x0/250)*250;gx<x0+W/k;gx+=250){const sx=(gx-x0)*k;s+=`<line x1="${sx}" y1="0" x2="${sx}" y2="${H}" stroke="#f0f" stroke-opacity=".5"/>`+(gx%500===0?`<text x="${sx+2}" y="12" font-size="11" fill="#f0f">${gx}</text>`:'')}
for(let gy=Math.ceil(y0/250)*250;gy<y0+H/k;gy+=250){const sy=(gy-y0)*k;s+=`<line x1="0" y1="${sy}" x2="${W}" y2="${sy}" stroke="#f0f" stroke-opacity=".5"/>`+(gy%500===0?`<text x="2" y="${sy-2}" font-size="11" fill="#f0f">${gy}</text>`:'')}
if(extra){for(const poly of JSON.parse(readFileSync(extra))){s+=`<path d="M${poly.map(p=>((p[0]-x0)*k)+' '+((p[1]-y0)*k)).join('L')}Z" fill="#00f" fill-opacity=".25" stroke="#00f"/>`}}
s+='</svg>';const buf=await sharp(out).composite([{input:Buffer.from(s)}]).png().toBuffer();await sharp(buf).toFile(out);
