import fs from 'node:fs';import sharp from 'sharp';import {ART,DATA,original,origin,width,height,rings,coast,props,obstacles,places,harbor,lanes,promenade,pathRing,additions,homes,roads,coastRoads} from './model.mjs';import {water,bridgeAreas,channels,crossings} from './waterways.mjs';
import {extensionBody} from './ground.mjs';
fs.mkdirSync(ART+'bigger',{recursive:true});for(const [src,body]of Object.entries(additions))fs.writeFileSync(ART+src,body);
const oldpath=original.world.coastRings.map(pathRing).join(' ');
const mask=`<defs><mask id="newonly" maskUnits="userSpaceOnUse" x="${origin.x}" y="${origin.y}" width="${width}" height="${height}"><rect x="${origin.x}" y="${origin.y}" width="${width}" height="${height}" fill="white"/><path d="${oldpath}" fill="black"/></mask></defs>`;
const tiles=[];
// Rasterise at the tile viewport. This bounds SVG mask working surfaces, as
// well as runtime textures; a full-island mask needlessly allocates huge buffers.
const reuse=process.argv.includes('--reuse-ground');
for(let row=0;row<8;row++)for(let col=0;col<10;col++){
 const w=width/10,h=height/8,x=origin.x+col*w,y=origin.y+row*h,src=`bigger/ground-${row}-${col}.svg`;
 if(!reuse){
  const vector=`<svg xmlns="http://www.w3.org/2000/svg" width="${w*.5}" height="${h*.5}" viewBox="${x} ${y} ${w} ${h}" stroke-linecap="round" stroke-linejoin="round">${mask}<g mask="url(#newonly)">${extensionBody}</g></svg>`;
  const png=await sharp(Buffer.from(vector)).png().toBuffer();
  fs.writeFileSync(ART+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w*.5}" height="${h*.5}" viewBox="0 0 ${w*.5} ${h*.5}"><image width="${w*.5}" height="${h*.5}" href="data:image/png;base64,${png.toString('base64')}"/></svg>`);
 }
 if(!fs.existsSync(ART+src))throw Error('Missing baked ground '+src);
 tiles.push({src,x,y,width:w,height:h,resolution:1});
}
// Original vector sources and their 1:1 tile resolutions remain unchanged. Derivative crops discard old ocean only.
for(const t of original.art.ground.tiles){
 const src='bigger/original-'+t.src;
 // Retain the original paint order without introducing a compositing group.
 // Remove the exterior sea-ripple backdrop, shallow-water shape. The original painted shoreline lip stays exact.
 const exact=fs.readFileSync(ART+t.src,'utf8')
 .replace(/<rect[^>]*fill="url\(#sea-ripples\)"[^>]*\/>/g,'')
 .replace(/<path\b[^>]*fill="#8FD6E6"[^>]*\/>/g,'');
 fs.writeFileSync(ART+src,exact);
 tiles.push({...t,src});
}
const art={...original.art,width,height,origin,ground:{...original.art.ground,tiles},props:[...original.art.props,...props]};
const world={...original.world,origin,width,height,coast,coastRings:rings,props:art.props,water:[...original.world.water,...water],bridges:[...original.world.bridges,...bridgeAreas],obstacles:[...original.world.obstacles,...obstacles],zones:{...original.world.zones,...Object.fromEntries(places.map(z=>['bigger-'+z.id,{...z,rx:850,ry:550}]))}};
const walk={...original.walk,origin,width,height,coast,coastRings:rings,water:[...original.walk.water,...water],bridges:[...original.walk.bridges,...bridgeAreas],obstacles:[...original.walk.obstacles,...obstacles]};
for(const [file,data]of [[ART+'art.json',art],[DATA+'world.json',world],[DATA+'walk-world.json',walk],[DATA+'harbor.json',harbor],[DATA+'placements.json',art.props]])fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
fs.writeFileSync('scripts/bigger-library/plan.json',JSON.stringify({origin,width,height,places,homes,roads,coastRoads,lanes,promenade,channels:channels.map(({id,name,points})=>({id,name,points})),crossings,newProps:props.length,newObstacles:obstacles.length},null,2)+'\n');console.log('Built',props.length,'new props;',tiles.length,'ground tiles');
