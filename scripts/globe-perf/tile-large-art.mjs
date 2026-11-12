import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sizes from '../../src/pixi/art-source-sizes.json' with {type:'json'};
import {WORLD_ISLANDS} from '../../src/pixi/world-map.js';
const selected=process.argv[2];
if(selected&&!WORLD_ISLANDS.some(i=>i.theme===selected))throw Error('Unknown theme '+selected);
const out='public/pixi-art/globe/tiles';mkdirSync(out,{recursive:true});const index=selected?JSON.parse(readFileSync('src/pixi/large-art-tiles.json')):{};
for(const {theme} of WORLD_ISLANDS.filter(i=>i.theme&&(!selected||i.theme===selected))){
 const base=`/pixi-art/themes/${theme}/`,art=JSON.parse(readFileSync(`public${base}art.json`)),records={};
 for(const category of ['decks','flats'])for(const p of art[category]??[]){
  const src=p.src.startsWith('/')?p.src:base+p.src,[iw,ih]=sizes[src],r=p.resolution??(category==='decks'?1.5:2);
  if(iw*ih*r*r*4<=8*1048576)continue;
  const key=[p.src,p.width,p.height,r].join('|'),hash=createHash('sha256').update(theme+key).digest('hex').slice(0,16);
  if(records[key])continue;
  const original=readFileSync('public'+src,'utf8').replace(/<\?xml[^>]*>/g,'').replace(/<!DOCTYPE[^>]*>/g,'');
  const start=original.indexOf('<svg'),end=original.indexOf('>',start),root=original.slice(start,end+1);
  const viewBox=root.match(/viewBox\s*=\s*["']([^"']+)["']/)?.[1]??`0 0 ${iw} ${ih}`;
  const body=original.slice(end+1,original.lastIndexOf('</svg>'));
  const attrs=root.replace(/^<svg/,'').replace(/>$/,'').replace(/\s(?:width|height|viewBox|preserveAspectRatio|x|y)\s*=\s*(["']).*?\1/g,'');
  const tiles=[];
  for(let y=0;y<p.height;y+=512)for(let x=0;x<p.width;x+=512){
   const w=Math.min(512,p.width-x),h=Math.min(512,p.height-y),file=`${hash}-${x}-${y}.svg`;
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><svg ${attrs} width="${p.width}" height="${p.height}" preserveAspectRatio="none" viewBox="${viewBox}">${body}</svg></svg>`;
   writeFileSync(`${out}/${file}`,svg);tiles.push({src:`/pixi-art/globe/tiles/${file}`,x,y,width:w,height:h,resolution:r*Math.max(iw/p.width,ih/p.height)});
  }
  records[key]=tiles;
 }
 index[theme]=records;console.log(`${theme}: ${Object.keys(records).length} oversized decorations tiled`);
}
writeFileSync('src/pixi/large-art-tiles.json',JSON.stringify(index)+'\n');
