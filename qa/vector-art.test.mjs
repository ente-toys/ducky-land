import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {WORLD_ISLANDS} from '../src/pixi/world-map.js';
import legacy from './legacy-raster-art.json' with {type:'json'};
const root=new URL('../public/pixi-art/',import.meta.url);

test('Pixi art rejects new rasters, with frozen legacy exceptions in exactly five theme folders',()=>{
 // These existing Library, Community, Goldmine, Bog and Cathedral assets must
 // be redrawn. Exact path+content hashes prevent adding rasters inside them.
 assert.deepEqual([...legacy.folders].sort(),['themes/library/','themes/community/','themes/goldmine/','themes/bog/','themes/cathedral/'].sort());
 const violations=[];
 function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);if(entry.isDirectory()){scan(file);continue;}
  const bytes=fs.readFileSync(file),rel=path.relative(fileURLToPath(root),file);
  if(/\.(?:png|jpe?g|webp)$/i.test(entry.name)||/<(?:[\w.-]+:)?image\b|data:\s*image/i.test(bytes.toString())){
   const frozen=legacy.folders.some(folder=>rel.startsWith(folder))&&legacy.files[rel]===createHash('sha256').update(bytes).digest('hex');
   if(!frozen)violations.push(file);
  }
 }}
 scan(fileURLToPath(root));
 assert.equal(violations.length,0,`${violations.length} new/changed raster violations under public/pixi-art:\n${violations.map(f=>path.relative(fileURLToPath(root),f)).join('\n')}`);
});

test('every globe preview and fallback is a bounded, self-contained vector matching its manifest',()=>{
 const dir=new URL('globe/',root),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',dir)));
 for(const island of WORLD_ISLANDS){const id=island.theme??'home';
  for(const suffix of ['', '-ground']){
   const svg=fs.readFileSync(new URL(`${id}${suffix}.svg`,dir),'utf8');
   assert.doesNotMatch(svg,/<(?:image|linearGradient|radialGradient|filter)\b|data:/i,id+suffix);
   assert.doesNotMatch(svg,/<style\b|\bclass=/,id+suffix+' has unresolved CSS');
   assert.ok(Buffer.byteLength(svg)<600000,`${id}${suffix} exceeds 600 KB`);
   assert.match(svg,/<svg[^>]*width="1024"/);
   const ids=new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
   for(const m of svg.matchAll(/(?:url\(#([^)]*)\)|(?:xlink:)?href="#([^"]+)")/g))assert.ok(ids.has(m[1]??m[2]),`${id}${suffix}: unresolved ${m[1]??m[2]}`);
   assert.equal(Buffer.byteLength(svg),manifest[id][suffix?'groundBytes':'bytes']);
   if(!suffix){assert.equal(manifest[id].src,`/pixi-art/globe/${id}.svg`);assert.equal(createHash('sha256').update(svg).digest('hex'),manifest[id].sha256);}
  }
 }
});
