import {WORLD_ISLANDS} from '../../world/world-map.js';

// Preserve the original 1022px content width. Square atlas cells used to
// stretch 700-1000px-high source pictures to 1022px without adding detail.
// Keep their native aspect in storage and let normalized shader UVs map each
// picture to the same world bounds. This removes padding, not source pixels.
export function globeAtlasLayout(arch){
 const columns=Math.ceil(Math.sqrt(WORLD_ISLANDS.length)),width=columns*1024;
 const cells=WORLD_ISLANDS.map((island,k)=>{
  const size=arch.globeSizeOf?.(island.id)??arch.globeTextureOf(island.id);
  return {x:k%columns*1024,y:0,width:1022,height:Math.min(1022,Math.ceil(1022*size.height/size.width))};
 });
 let height=0;
 for(let start=0;start<cells.length;start+=columns){
  const row=cells.slice(start,start+columns);
  for(const cell of row)cell.y=height;
  height+=Math.max(...row.map(c=>c.height))+2;
 }
 const uvs=new Float32Array(13*4);
 cells.forEach((c,k)=>uvs.set([(c.x+1)/width,(c.y+1)/height,c.width/width,c.height/height],k*4));
 return {width,height,cells,uvs};
}
