import sizes from './art-source-sizes.json' with {type:'json'};
export function artResolution(entry, native = entry.resolution ?? 2, sourceSizes = sizes, screen) {
  const size=sourceSizes[entry.src];
  if(!size || !entry.width || !entry.height)return native;
  const scale=entry.scale??1;
  const needed=Math.max(entry.width/size[0],entry.height/size[1])*scale*(screen ? screen.zoom*screen.dpr : 4);
  return Math.min(native,screen ? needed : Math.ceil(needed*16)/16);
}
