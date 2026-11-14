import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
export const baselineRef='ente/main';
export async function loadPlacements(ref){
 const plugins=ref?[{name:'git-baseline',setup(b){b.onLoad({filter:/\.(js|mjs|json)$/},args=>{const rel=path.relative(process.cwd(),args.path);if(rel.startsWith('node_modules/'))return;try{return {contents:execFileSync('git',['show',`${ref}:${rel}`],{maxBuffer:30e6}).toString(),loader:rel.endsWith('.json')?'json':'js'};}catch{return;}});}}]:[];
 const r=await build({stdin:{resolveDir:process.cwd(),contents:`export * from './src/world/home/placements.js';export {solidBuilding} from './src/world/home/building-footprints.js';export {harborWorld} from './src/gameplay/islands.js';export {sleepHalfWidths} from './src/world/home/sleep-spots.js';`},plugins,bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
 return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
}
export function compact(p){const {footprint,bodyFootprint,...q}=p;return q;}
