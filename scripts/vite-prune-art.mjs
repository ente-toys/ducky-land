import {readFile, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
const nativeImport=new Function('specifier','return import(specifier)');

// Vite copies all of public/ into the build. Most island art there is only a
// build input now: ground tiles become vector meshes and props are packed into
// sheets. Remove those copies from the output unless the shipped code names them.
export function pruneUnusedArt(){
 let config;
 return {name:'prune-unused-art',apply:'build',
  configResolved(value){config=value;},
  async closeBundle(){
   const out=path.resolve(config.root,config.build.outDir),dir=path.join(out,'art-prerender');
   const {groundTiles,ISLANDS}=await nativeImport(new URL('./ground-mesh/build.mjs',import.meta.url).href);
   const candidates=new Set();
   for(const id of [...ISLANDS,'bog-arena'])for(const t of await groundTiles(config.root,id))if(t.src.endsWith('.svg'))candidates.add(t.src);
   const names=await readdir(dir);
   for(const name of names.filter(n=>/^manifest-.*\.json$/.test(n))){
    const manifest=JSON.parse(await readFile(path.join(dir,name),'utf8'));
    for(const [src,entry] of Object.entries(manifest))if(src.endsWith('.svg')&&!entry.svgText&&entry.tiers?.length&&entry.tiers.every(t=>t.sheet))candidates.add(src);
   }
   const code=(await Promise.all((await readdir(path.join(out,'assets'))).filter(n=>n.endsWith('.js')).map(n=>readFile(path.join(out,'assets',n),'utf8')))).join('\n');
   let removed=0;
   for(const src of candidates){if(code.includes(src))continue;await rm(path.join(out,src),{force:true});removed++;}
   config.logger.info(`Pruned ${removed} build-only art files from the output`);
  }};
}
