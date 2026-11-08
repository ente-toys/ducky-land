import sizes from './art-source-sizes.json' with {type:'json'};
// Every supported close-up pixel is retained: 1.8x maximum zoom, 2x DPR,
// plus 11% raster headroom. Reused SVGs often have enormous intrinsic boxes
// (a 1,592px umbrella is placed at 220 world units). Rasterizing those at 2x
// wastes tens of MiB without adding a single visible pixel.
export function artResolution(entry, native = entry.resolution ?? 2, sourceSizes = sizes) {
  const size=sourceSizes[entry.src];
  if(!size || !entry.width || !entry.height)return native;
  const scale=entry.scale??1;
  const needed=Math.max(entry.width/size[0],entry.height/size[1])*scale*4;
  return Math.min(native,Math.ceil(needed*16)/16);
}
