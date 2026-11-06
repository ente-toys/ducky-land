// Load the real Neon runtime without writing the shared generated registry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Texture} from 'pixi.js';
import {loadThemeArt} from '../../src/pixi/theme-art.js';
import {makeMap} from '../../src/pixi/island-maps.js';
import {checkTheme} from '../theme-index.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const A='public/pixi-art/themes/neon/',D='rive/web/themes/neon/';
const checked=checkTheme('neon');assert(checked.ready);
const map=makeMap('neon',{world:read(D+'world.json'),walk:read(D+'walk-world.json'),harbor:read(D+'harbor.json'),sleepers:checked.sleepers,art:'/pixi-art/themes/neon/art.json'});
const original=globalThis.fetch;
globalThis.fetch=async url=>({ok:true,json:async()=>read('public'+url)});
let acquired=0,released=0;
try{
 const art=await loadThemeArt(map,{acquire:async src=>{assert(src.endsWith('.svg'));assert(fs.existsSync('public'+src));acquired++;return Texture.EMPTY},release:()=>released++});
 assert.equal(art.props.filter(p=>p.centrePiece?.animate).length,4);
 assert.equal(art.props.filter(p=>p.id.startsWith('neon-ten-bench-')).length,14);
 assert(art.props.filter(p=>p.id.startsWith('neon-ten-bench-')).every(p=>!p.wind));
 art.destroy();assert.equal(acquired,released);
 const result={theme:'neon',pass:true,textureReferences:acquired,released,clockMovingParts:4,curvedBenches:14,sleepers:checked.sleepers.length};
 fs.writeFileSync(A+'runtime-results.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{globalThis.fetch=original}
