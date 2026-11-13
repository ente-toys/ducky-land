import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const SOURCE_VERSION=1;
export const sha256=value=>createHash('sha256').update(value).digest('hex');
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined&&typeof value[k]!=='function').map(k=>[k,stable(value[k])]));
 return value;
}
export const modelHash=({map,art})=>sha256(JSON.stringify(stable({map:{id:map.id,home:map.home,art:map.art,width:map.width,height:map.height,origin:map.origin,cx:map.cx,cy:map.cy,world:map.world},art})));
const boundaries=new Set(['src/world/island-maps.js','src/world/world-map.js','src/world/delivered-themes.js']);
function relative(root,file){
 const p=path.relative(root,path.resolve(root,file)).split(path.sep).join('/');
 if(p==='..'||p.startsWith('../')||path.isAbsolute(p))throw Error(`Globe source outside repository: ${file}`);
 return p;
}
function resolveFile(root,file){
 for(const p of [file,file+'.js',file+'.mjs',file+'.json'])if(fs.existsSync(path.join(root,p))&&fs.statSync(path.join(root,p)).isFile())return p;
 throw Error(`Missing globe source: ${file}`);
}

export function createSourceTracker(root,theme,{codeEntries=['scripts/globe-svg/build.mjs','scripts/globe-svg/vector.mjs','scripts/globe-svg/compile.mjs','scripts/globe-svg/sources.mjs','src/world/island-maps.js',...(theme==='home'?['src/world/home/placements.js','scripts/globe-perf/snapshot.mjs']:[])]}={}){
 root=path.resolve(root);const files=new Map(),visited=new Set();
 function record(file,consumed){
  if(String(file).startsWith('@'))return;
  const p=relative(root,file),bytes=consumed===undefined?fs.readFileSync(path.join(root,p)):Buffer.from(consumed);files.set(p,sha256(bytes));
  if(/\.svg$/i.test(p)&&!visited.has(p)){
   visited.add(p);const text=bytes.toString();
   for(const m of text.matchAll(/(?:\b(?:xlink:)?href\s*=\s*["']([^"']+)["']|url\(\s*["']?([^)'"\s]+))/g)){
    const ref=(m[1]??m[2]).split('#')[0];if(!ref||/^(?:data:|https?:|\/\/)/i.test(ref))continue;
    const target=ref.startsWith('/pixi-art/')?'public'+ref:ref.startsWith('/')?ref.slice(1):path.join(path.dirname(p),ref);
    record(target);
   }
  }
 }
 function code(file){
  const p=resolveFile(root,relative(root,file));if(visited.has(p))return;visited.add(p);record(p);
  if(boundaries.has(p)||!/\.[cm]?js$/.test(p))return;
  const text=fs.readFileSync(path.join(root,p),'utf8');
  for(const m of text.matchAll(/(?:\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?|\bimport\s*\()\s*["'](\.[^"']+)["']/g))code(path.join(path.dirname(p),m[1]));
 }
 for(const entry of codeEntries)code(entry);
 return {record,recordCode:code,snapshot(model){
  const inputs=[...files].sort(([a],[b])=>a.localeCompare(b)).map(([file,hash])=>({path:file,sha256:hash}));
  const data={version:SOURCE_VERSION,theme,modelSha256:modelHash(model),files:inputs};
  return {...data,sha256:sha256(JSON.stringify(data))};
 }};
}

export function verifySourceSnapshot(root,theme,entry,model){
 const problems=[],sources=entry?.sources;
 if(!sources||sources.version!==SOURCE_VERSION)return [`${theme}: missing current source fingerprint; run node scripts/globe-svg/build.mjs ${theme}`];
 if(sources.theme!==theme)problems.push(`${theme}: fingerprint belongs to ${sources.theme}`);
 if(entry.src!==`/pixi-art/globe/${theme}.svg`)problems.push(`${theme}: invalid generated preview URL`);
 if(sources.modelSha256!==modelHash(model))problems.push(`${theme}: current map bounds or authored placements changed`);
 if(!Array.isArray(sources.files)||sources.files.length===0)problems.push(`${theme}: empty source dependency list`);
 for(const input of sources.files??[]){
  try{const p=relative(root,input.path);if(sha256(fs.readFileSync(path.join(root,p)))!==input.sha256)problems.push(`${theme}: changed source ${p}`);}catch(error){problems.push(`${theme}: missing/invalid source ${input.path}`);}
 }
 const {sha256:recorded,...data}=sources;
 if(sha256(JSON.stringify(data))!==recorded)problems.push(`${theme}: invalid source fingerprint`);
 for(const [suffix,key]of [['','sha256'],['-ground','groundSha256']]){
  const file=`public/pixi-art/globe/${theme}${suffix}.svg`;
  try{if(!entry[key]||sha256(fs.readFileSync(path.join(root,file)))!==entry[key])problems.push(`${theme}: missing or changed generated ${theme}${suffix}.svg`);}catch{problems.push(`${theme}: missing generated ${theme}${suffix}.svg`);}
 }
 return problems;
}
