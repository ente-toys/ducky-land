import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const raster=/\.(?:png|webp|jpe?g|gif|avif|bmp|ico)$/i;
const files=[];
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else files.push(p);}}
scan('public');
assert.deepEqual(files.filter(p=>raster.test(p)),[], 'public/ contains raster art');
const vectors=files.filter(p=>/\.svg$/i.test(p));
for(const p of vectors)assert.ok(/<svg\b/i.test(fs.readFileSync(p,'utf8')),`${p}: not an SVG document`);
assert.deepEqual(vectors.filter(p=>/<image\b|data:image\/(?:png|webp|jpeg|gif|avif)/i.test(fs.readFileSync(p,'utf8'))),[], 'SVG contains a raster image');
const manifests=[];
function references(v,where){
 if(!v||typeof v!=='object')return;
 for(const [key,value]of Object.entries(v)) {
  if(typeof value==='string'&&/^(?:src|url|file|front)$/.test(key))assert.ok(!raster.test(value),`${where}: ${key} = ${value}`);
  else if(value&&typeof value==='object')references(value,where);
 }
}
for(const p of files.filter(p=>/\.json$/i.test(p)&&!p.includes('/source/'))) {
 references(JSON.parse(fs.readFileSync(p,'utf8')),p);manifests.push(p);
}
for(const e of fs.readdirSync('src/pixi'))if(e.endsWith('.json'))references(JSON.parse(fs.readFileSync(path.join('src/pixi',e),'utf8')),e);
console.log(JSON.stringify({publicRasterFiles:0,embeddedRasterImages:0,svgFiles:vectors.length,publicJsonManifests:manifests.length}));
