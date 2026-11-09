// Review artifacts only, never game art. Originals must be saved before removal.
// node scripts/globe-svg/compare.mjs [old-png-directory] [output-directory]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const old=process.argv[2]??'/private/tmp/ducky-globe-originals';
const out=process.argv[3]??'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/globe-svg';
const manifest=JSON.parse(fs.readFileSync('public/pixi-art/globe/manifest.json'));
fs.mkdirSync(out,{recursive:true});const measurements=[];
for(const [id,entry]of Object.entries(manifest)){
 const layers=[],width=768,height=Math.ceil(width*entry.height/entry.width),row=height+28;
 for(const [i,suffix]of ['', '-ground'].entries())for(const [col,file]of [path.join(old,id+suffix+'.png'),`public/pixi-art/globe/${id}${suffix}.svg`].entries()){
  const start=performance.now(),image=await sharp(file).resize(width,height,{fit:'contain',background:'#6ec9de'}).png().toBuffer();
  if(col===1){const nativeStart=performance.now();await sharp(file).raw().toBuffer();measurements.push({file:path.basename(file),bytes:fs.statSync(file).size,rasterMs:+(performance.now()-nativeStart).toFixed(1),comparisonMs:+(performance.now()-start).toFixed(1)});}
  const label=`${id}${suffix} / ${col?'new SVG':'old PNG'}`;
  layers.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="768" height="28"><text x="12" y="20" font-family="sans-serif" font-size="16" fill="#173c3d">${label}</text></svg>`),left:col*width,top:i*row});
  layers.push({input:image,left:col*width,top:i*row+28});
 }
 await sharp({create:{width:width*2,height:row*2,channels:4,background:'#6ec9de'}}).composite(layers).png().toFile(path.join(out,`compare-${id}.png`));
 console.log(`compare-${id}.png`);
}
fs.writeFileSync(path.join(out,'sizes-and-raster-times.json'),JSON.stringify({method:'Single native-size Sharp/librsvg CPU raster per SVG. Not a browser/GPU benchmark.',files:measurements},null,2)+'\n');
