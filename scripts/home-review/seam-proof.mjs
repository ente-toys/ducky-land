import fs from 'node:fs';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const out=process.env.HOME_REVIEW_OUT;
if(!out)throw Error('HOME_REVIEW_OUT required');
fs.mkdirSync(out+'/seams',{recursive:true});
const P=JSON.parse(fs.readFileSync(out+'/placements.json'));
const E=JSON.parse(fs.readFileSync('src/pixi/home-expansion.json'));
const g=fs.readFileSync('scripts/home-review/continuous-ground.svgfrag','utf8');
const checked=[];
for(const t of P.tiles){
 const s=fs.readFileSync('public'+t.src,'utf8');
 assert.equal(s.slice(s.indexOf('>')+1,s.lastIndexOf('</svg>')),g,'a tile has obsolete ground art: '+t.src);
 const box=s.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
 assert.deepEqual(box,[t.x,t.y,t.width+(t.bleed??0),t.height+(t.bleed??0)]);
 checked.push(t.src);
}
const k=.75;
async function patch([x,y,w,h]){
 const W=Math.round(w*k),H=Math.round(h*k);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#6ec9de"/>${g}</svg>`;
 return sharp(Buffer.from(svg)).png().toBuffer();
}
async function sheet(name,bands,vertical){
 const W=vertical?bands.length*132:Math.max(1040,...bands.map(([,b])=>Math.round(b[2]*k))),H=vertical?Math.max(...bands.map(([,b])=>Math.round(b[3]*k)))+28:bands.length*144;
 const layers=[];
 for(let i=0;i<bands.length;i++){
  const [label,box]=bands[i];
  const left=vertical?i*132:0,top=vertical?28:i*144+24;
  layers.push({input:await patch(box),left,top});
  layers.push({input:Buffer.from(`<svg width="${vertical?132:1040}" height="24"><text x="3" y="16" fill="#39472d" font-family="sans-serif" font-size="10">${label}</text></svg>`),left,top:top-24});
 }
 await sharp({create:{width:W,height:H,channels:4,background:'#fff0c7'}}).composite(layers).png().toFile(out+'/seams/'+name+'.png');
}
// Every expanded-grid boundary segment, full length, at a 97.5-pixel Ducky scale.
let boundaries=0;
for(let row=0;row<6;row++){
 const bands=[];
 for(let col=1;col<8;col++){
  const x=E.origin.x+1375*col,y=E.origin.y+1375*row;
  bands.push([`r${row} x${Math.round(x)}`,[x-80,y,160,1375]]);boundaries++;
 }
 await sheet('vertical-row-'+row,bands,true);
}
for(let row=1;row<6;row++){
 const bands=[];
 for(let col=0;col<8;col++){
  const x=E.origin.x+1375*col,y=E.origin.y+1375*row;
  bands.push([`c${col} y${Math.round(y)}`,[x,y-80,1375,160]]);boundaries++;
 }
 await sheet('horizontal-row-'+row,bands,false);
}
// Inspect the centre overlay's differently sized tile boundaries too.
const core=P.tiles.filter(t=>t.src.includes('/home-expansion/'));
const coreV=[],coreH=[];
for(const a of core)for(const b of core){
 if(Math.abs(a.x+a.width-b.x)<.01&&a.y===b.y)coreV.push([`core x${b.x} y${a.y}`,[b.x-80,a.y,160,a.height]]);
 if(Math.abs(a.y+a.height-b.y)<.01&&a.x===b.x)coreH.push([`core y${b.y} x${a.x}`,[a.x,b.y-80,a.width,160]]);
}
await sheet('core-vertical',coreV,true);
await sheet('core-horizontal',coreH,false);
const fallback=fs.readFileSync('public/pixi-art/globe/home-ground.svg','utf8');
assert.equal(fallback.slice(fallback.indexOf('>')+1,fallback.lastIndexOf('</svg>')),g);
fs.writeFileSync(out+'/seams/audit.json',JSON.stringify({groundTiles:checked.length,expandedBoundarySegments:boundaries,coreBoundarySegments:coreV.length+coreH.length,standingDuckPixels:130*k,canonicalArtIdentical:true,trueBleedGeometry:true,streamingFallbackMatches:true,checked},null,2));
console.log('Seams:',boundaries,'full-length segments at duck zoom;',checked.length,'canonical tile bodies; fallback matches.');
