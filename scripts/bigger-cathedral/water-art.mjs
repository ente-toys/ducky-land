import fs from 'node:fs';
const A='public/pixi-art/themes/cathedral/';
export function rebuildWaterArt(art){
 const coast=JSON.parse(fs.readFileSync('scripts/bigger-cathedral/water-coast.json'));
 if(art.sea.toUpperCase()!==coast.sea)throw Error('Bellovo inland water must equal the sea');
 const tiles=coast.tiles.map(t=>{
  const {sea,foam,sand}=coast.paths;
  const path=(d,fill)=>`<path fill="${fill}" fill-rule="evenodd" d="${d}"/>`;
  const body=path(sea,art.sea)+path(foam,coast.foam)+path(sand,coast.sand);
  fs.writeFileSync(A+t.src,`<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}" viewBox="${t.x} ${t.y} ${t.width} ${t.height}" data-bellovo-shore="joined-sea-river">${body}</svg>\n`);
  return {...t,resolution:1};
 });
 const old=new Set(art.ground.tiles.filter(t=>t.src.startsWith('bridges/water-')).map(t=>t.src));
 art.ground.tiles=art.ground.tiles.filter(t=>!t.src.startsWith('bridges/water-')).concat(tiles);
 for(const src of old)if(!tiles.some(t=>t.src===src)&&fs.existsSync(A+src))fs.unlinkSync(A+src);
}
if(process.argv[1]?.endsWith('/water-art.mjs')){
 const art=JSON.parse(fs.readFileSync(A+'art.json'));rebuildWaterArt(art);fs.writeFileSync(A+'art.json',JSON.stringify(art,null,2)+'\n');console.log('Joined Bellovo coast and inland water rebuilt.');
}
