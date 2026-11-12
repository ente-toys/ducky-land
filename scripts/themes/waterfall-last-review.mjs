import sharp from 'sharp';
import {readFileSync,writeFileSync} from 'node:fs';
const d='../concepts/themes/work/waterfall/',k=.85,W=1200,H=950,head=44;
const rows=[['Main lookout',[2820,2370],[3900,3650]],['Fern activity rim',[3300,2470],[1730,2600]],['Lagoon activity rim',[3300,2470],[6100,2600]],['South picnic rim',[3300,2470],[3900,4520]]];
const composite=[];
for(const [i,[name,home,fall]] of rows.entries())for(const [j,file,xy] of [[0,'waterfall-home-detail-source.png',home],[1,'waterfall-detail-source.png',fall]]){
 const buf=await sharp(d+file).extract({left:Math.round(xy[0]*k-W/2),top:Math.round(xy[1]*k-H/2),width:W,height:H}).png().toBuffer();
 composite.push({input:buf,left:j*W,top:i*(H+head)+head});
 const title=Buffer.from(`<svg width="${W}" height="${head}"><rect width="100%" height="100%" fill="#FFF0C7"/><text x="18" y="29" font-size="19" font-family="sans-serif" fill="#39472D">${j?'WATERFALL':'HOME'} / ${name} / matched 0.85 px per unit / static SVG</text></svg>`);
 composite.push({input:title,left:j*W,top:i*(H+head)});
}
await sharp({create:{width:W*2,height:rows.length*(H+head),channels:4,background:'#6EC9DE'}}).composite(composite).png().toFile(d+'last-waterfall-round-1-vs-home.png');
const path='public/pixi-art/themes/waterfall/centre/centre.json';
const c=JSON.parse(readFileSync(path)),a=JSON.parse(readFileSync('public/pixi-art/themes/waterfall/art.json'));
for(const p of c.pieces){const q=[...a.flats,...a.props].find(q=>q.centrePiece?.id===p.id);if(q && (p.id==='water-sheet'||p.id==='foam'||p.id.startsWith('flow-')||p.id.startsWith('impact-ripple-')))Object.assign(p,q.centrePiece);}
writeFileSync(path,JSON.stringify(c,null,2)+'\n');
console.log('Saved matched-scale Home comparison and synchronized Waterfall centre metadata.');
