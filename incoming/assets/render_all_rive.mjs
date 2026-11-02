import fs from 'node:fs';
import {createCanvas,Path2D,Image,DOMMatrix} from './render-runtime/node_modules/@napi-rs/canvas/index.js';
import Rive from './render-runtime/node_modules/@rive-app/canvas-advanced/canvas_advanced.mjs';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('/Users/pragadees.xd/Developer/ente-merch/node_modules/sharp');
globalThis.Path2D=Path2D;globalThis.Image=Image;globalThis.DOMMatrix=DOMMatrix;
globalThis.document={createElement:n=>{if(n!=='canvas')return {};const c=createCanvas(1,1);return new Proxy(c,{get(t,k){if(k==='getContext')return kind=>kind==='2d'?t.getContext('2d'):null;const v=t[k];return typeof v==='function'?v.bind(t):v;},set(t,k,v){t[k]=v;return true;}})},fonts:{add(){}}};
const rt=await Rive({wasmBinary:fs.readFileSync('render-runtime/node_modules/@rive-app/canvas-advanced/rive.wasm')});
const file=await rt.load(new Uint8Array(fs.readFileSync('pipeline-all/build/ducky-asset-library.riv')),undefined,false);
const m=JSON.parse(fs.readFileSync('assets/manifest.json'));const results=[];const sc=.4;
fs.mkdirSync('qa',{recursive:true});
for(const a of m.assets){
 const ab=file.artboardByName(a.category+'-'+a.name);
 if(!ab)throw new Error('Missing artboard '+a.name);
 const w=Math.ceil(a.size.width*sc),h=Math.ceil(a.size.height*sc);
 const canvas=createCanvas(w,h),ctx=canvas.getContext('2d'),renderer=rt.makeRenderer(canvas);
 renderer.beginFrame();ab.advance(1/60);renderer.save();renderer.align(rt.Fit.contain,rt.Alignment.center,{minX:0,minY:0,maxX:w,maxY:h},ab.bounds);ab.draw(renderer);renderer.restore();renderer.flush();rt.resolveAnimationFrame();
 const dir='qa/rive/'+a.category;fs.mkdirSync(dir,{recursive:true});
 const actual=canvas.toBuffer('image/png');fs.writeFileSync(dir+'/'+a.name+'.png',actual);
 let svg=fs.readFileSync(a.file,'utf8').replace(/width="[^"]+" height="[^"]+"/,`width="${w}" height="${h}"`);
 const expected=await sharp(Buffer.from(svg)).flatten({background:'#FFF4C5'}).removeAlpha().raw().toBuffer();
 const got=await sharp(actual).flatten({background:'#FFF4C5'}).removeAlpha().raw().toBuffer();
 let sum=0,bad=0;for(let i=0;i<expected.length;i+=3){let max=0;for(let c=0;c<3;c++){let d=Math.abs(expected[i+c]-got[i+c]);sum+=d;max=Math.max(max,d)}if(max>40)bad++;}
 results.push({name:a.name,category:a.category,width:w,height:h,mean_absolute_rgb:sum/expected.length,fraction_pixels_channel_delta_gt_40:bad/(w*h)});
 renderer.delete();ab.delete();
}
file.delete();
results.sort((a,b)=>b.mean_absolute_rgb-a.mean_absolute_rgb);
fs.writeFileSync('qa/rive-pixel-comparison.json',JSON.stringify({count:results.length,scale:sc,reference_renderer:'librsvg 2.62.91',rive_renderer:'Rive Canvas2D WASM 2.43.1 with Skia CPU',results},null,2));
console.log(JSON.stringify({rendered:results.length,worst:results.slice(0,8)},null,2));
