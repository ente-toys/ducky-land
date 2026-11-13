// Run explicitly after changing authored art. Build output stays in dist;
// this file records only conservative transparent margins, never new pictures.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {collectPlacedArt} from '../scripts/vite-prerender-art.mjs';
const sizes=JSON.parse(await readFile('src/rendering/shared/art-source-sizes.json'));
const entries=await collectPlacedArt(process.cwd());
const sources=[...new Set(entries.map(e=>e.src).filter(src=>src.startsWith('/pixi-art/')&&!/\/globe\/|\/fx\/|\/home-kites\/|water-texture|centre\/dancer\.svg/.test(src)&&sizes[src]))].sort();
const bounds={},hashes={};let cursor=0;
await Promise.all(Array.from({length:2},async()=>{
  while(cursor<sources.length){
    const src=sources[cursor++],[nativeW,nativeH]=sizes[src],w=Math.ceil(nativeW),h=Math.ceil(nativeH);
    if(w*h<4096)continue;
    const input=await readFile('public'+src);
    // Use the full native raster, so even a faint one-pixel detail survives.
    const {data,info}=await sharp(input).resize(w,h,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let x0=w,y0=h,x1=0,y1=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*info.channels+info.channels-1]){
      x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);
    }
    // Eight native pixels protect antialiasing at all supported raster tiers.
    const left=Math.max(0,x0-8),top=Math.max(0,y0-8),right=Math.min(w,x1+8),bottom=Math.min(h,y1+8);
    if(x0===w||((right-left)*(bottom-top)<w*h*.95)){
      bounds[src]=x0===w?null:[left*nativeW/w,top*nativeH/h,(right-left)*nativeW/w,(bottom-top)*nativeH/h];
      hashes[src]=createHash('sha256').update(input).digest('hex');
    }
  }
}));
const sorted=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b)));
const lines=o=>Object.entries(sorted(o)).map(([key,value])=>'  '+JSON.stringify(key)+':'+JSON.stringify(value)).join(',\n');
await writeFile('src/rendering/shared/art-visible-bounds.json','{\n'+lines(bounds)+'\n}\n');
await writeFile('qa/art-visible-bounds-hashes.json','{\n'+lines(hashes)+'\n}\n');
console.log(`Recorded ${Object.keys(bounds).length} trimmed sources (${Object.values(bounds).filter(v=>v===null).length} empty)`);
