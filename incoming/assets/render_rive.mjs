// Genuine .riv rendering through Rive's Canvas2D WASM runtime and Skia CPU.
// This fallback needs no Metal device, browser, script signing or account.
import fs from 'node:fs';
import {createCanvas,Path2D,Image,DOMMatrix} from './render-runtime/node_modules/@napi-rs/canvas/index.js';
import Rive from './render-runtime/node_modules/@rive-app/canvas-advanced/canvas_advanced.mjs';
globalThis.Path2D=Path2D;globalThis.Image=Image;globalThis.DOMMatrix=DOMMatrix;
globalThis.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),16);
globalThis.cancelAnimationFrame=clearTimeout;
globalThis.document={createElement:n=>{if(n!=='canvas')return {};const c=createCanvas(1,1);return new Proxy(c,{get(t,k){if(k==='getContext')return kind=>kind==='2d'?t.getContext('2d'):null;const v=t[k];return typeof v==='function'?v.bind(t):v;},set(t,k,v){t[k]=v;return true;}})},fonts:{add(){}}};
const rt=await Rive({wasmBinary:fs.readFileSync(new URL('./render-runtime/node_modules/@rive-app/canvas-advanced/rive.wasm',import.meta.url))});
const file=await rt.load(new Uint8Array(fs.readFileSync(process.argv[2]||'pipeline-five/build/ducky-five-imports.riv')),undefined,false);
const names=[];for(let i=0;i<file.artboardCount();i++){const a=file.artboardByIndex(i);names.push(a.name);a.delete();}
const ab=process.argv[4]?file.artboardByName(process.argv[4]):file.defaultArtboard();
const bounds=ab.bounds;
const width=Math.ceil(bounds.maxX-bounds.minX),height=Math.ceil(bounds.maxY-bounds.minY);
const scale=process.argv[5]?Number(process.argv[5]):1;
const canvas=createCanvas(Math.ceil(width*scale),Math.ceil(height*scale));
const renderer=rt.makeRenderer(canvas);
ab.advance(1/60);renderer.beginFrame();renderer.save();renderer.align(rt.Fit.contain,rt.Alignment.center,{minX:0,minY:0,maxX:canvas.width,maxY:canvas.height},ab.bounds);ab.draw(renderer);renderer.restore();renderer.flush();rt.resolveAnimationFrame();
const output=process.argv[3]||'pipeline-five/proof.png';fs.writeFileSync(output,canvas.toBuffer('image/png'));
console.log(JSON.stringify({renderer:'Rive Canvas2D WASM, Skia CPU',runtime:'@rive-app/canvas-advanced 2.43.1',artboards:names,selected:ab.name,bounds,output,canvas:[canvas.width,canvas.height]}));
renderer.delete();ab.delete();file.delete();
