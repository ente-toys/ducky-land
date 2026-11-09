import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {inline} from '../scripts/globe-svg/vector.mjs';
import {compile,markup,rectClip} from '../scripts/globe-svg/compile.mjs';
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${body}</svg>`;
async function render(text){return sharp(Buffer.from(text)).ensureAlpha().raw().toBuffer();}
const pixel=(a,x,y)=>[...a.subarray((y*100+x)*4,(y*100+x)*4+4)];
async function check(body,samples){const source=svg(body),compiled=markup(compile(inline(source),{clip:rectClip([[0,0,100,100]])})),[a,b]=await Promise.all([render(source),render(svg(compiled))]);for(const [x,y]of samples){const before=pixel(a,x,y),after=pixel(b,x,y);assert.ok(before.every((v,i)=>Math.abs(v-after[i])<25),`paint at ${x},${y}: ${before} -> ${after}`);}assert.doesNotMatch(compiled,/<use|class=|<style/);return compiled;}

test('thin inherited strokes cannot remove wider child paths, plazas or bridges',async()=>{
 await check('<rect width="100" height="100" fill="#91c43d"/><g fill="none" stroke="#39472d" stroke-width=".1"><path d="M10 50H90" stroke="#f6dfa8" stroke-width="12"/><ellipse cx="50" cy="50" rx="15" ry="12" fill="#f6dfa8"/><path d="M48 15V85" stroke="#be8d50" stroke-width="7"/></g>',[[20,50],[50,50],[50,25],[20,20]]);
});
test('CSS and referenced artwork resolve to explicit source paint',async()=>{
 const out=await check('<style>.wall{fill:#f4b5ce}.roof{fill:#9075bc}</style><defs><g id="house"><path class="wall" d="M0 20H30V50H0Z"/><path class="roof" d="M-5 20 15 0 35 20Z"/><rect x="12" y="31" width="7" height="19" fill="#fff0c7"/></g></defs><g fill="none"><use href="#house" x="15" y="20"/><use href="#house" x="60" y="20"/></g>',[[20,50],[30,30],[30,60],[70,50],[75,30]]);
 assert.doesNotMatch(out,/fill="(?:black|#000(?:000)?)"/i);
});
test('boolean clipping preserves stroke-ring holes instead of filling houses and coasts',async()=>{
 await check('<rect width="100" height="100" fill="#91c43d"/><path d="M10 10H90V90H10Z" fill="none" stroke="#f6c4d5" stroke-width="4"/><g clip-path="url(#crop)"><path d="M25 25H75V75H25Z" fill="none" stroke="#39472d" stroke-width="3"/></g><defs><clipPath id="crop"><rect width="100" height="100"/></clipPath></defs>',[[50,50],[11,50],[26,50],[40,40],[5,5]]);
});
test('same-fill merging keeps overlapping paint in its authored order',async()=>{
 await check('<rect x="10" y="10" width="60" height="60" fill="#e99cb6"/><rect x="30" y="30" width="60" height="60" fill="#6ec9de"/><rect x="40" y="50" width="30" height="20" fill="#e99cb6"/>',[[20,20],[40,40],[50,60],[80,80]]);
});
test('opaque grass and paving pattern bases survive texture simplification',async()=>{
 await check('<defs><pattern id="grass" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#91c43d"/><path d="M3 3l2-1" stroke="#71952d" stroke-width=".1"/></pattern></defs><rect width="100" height="100" fill="#fde48c"/><rect x="5" y="5" width="90" height="90" fill="url(#grass)"/>',[[50,50],[10,10],[1,1]]);
});
test('unresolved instances fail generation instead of becoming black fallback art',()=>{
 assert.throws(()=>compile(inline(svg('<use href="#missing-house"/>'))),/Unresolved SVG instance/);
});
