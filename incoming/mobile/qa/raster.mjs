// Software-only pixel review for environments without Metal/Chrome launching.
// These are native Rive renders, explicitly not Chrome mobile screenshots.
import fs from 'node:fs';
import { createCanvas, Path2D, DOMMatrix } from '@napi-rs/canvas';
import Rive from '@rive-app/canvas-advanced';
globalThis.Path2D = Path2D;
globalThis.DOMMatrix = DOMMatrix;
globalThis.OffscreenCanvas = class { constructor(w,h) { return createCanvas(w,h); } };
globalThis.document = { currentScript:null,createElement:()=>createCanvas(1,1),addEventListener(){},removeEventListener(){},body:{appendChild(){},remove(){}} };
const runtime = await Rive({wasmBinary: fs.readFileSync('node_modules/@rive-app/canvas-advanced/rive.wasm')});
console.log('software WASM ready');
const file = await runtime.load(new Uint8Array(fs.readFileSync('rive/web/ducky-land.riv')),undefined,false);
const artboard = file.artboardByName('Plaza');
const vmi = file.viewModelByName('PlazaVM').defaultInstance();
artboard.bindViewModelInstance(vmi);
const sm = new runtime.StateMachineInstance(artboard.stateMachineByName('Plaza'),artboard);
sm.bindViewModelInstance(vmi);
const canvas = createCanvas(390*3,844*3);
const renderer = runtime.makeRenderer(canvas);
artboard.width=390;artboard.height=844;
for(const [k,v] of Object.entries({zoom:390/620,cameraX:195-800*390/620,cameraY:422-500*390/620,controlX:281,controlY:808})) vmi.number(k).value=v;
for(let i=0;i<13;i++){
  const slot=vmi.viewModel('slot'+i),a=2*Math.PI*i/13;
  for(const [k,v] of Object.entries({x:800+390*Math.cos(a),y:640+225*Math.sin(a),cap:i%13+1,city:i%4,isPlayer:i===0?1:0,action:i%4}))slot.number(k).value=v;
  slot.string('name').value=i===0?' you ':` duck${i} `;
}
for(let f=0;f<90;f++){sm.advanceAndApply(1/60);artboard.advance(1/60);}
renderer.clear();renderer.save();renderer.scale(3,3);artboard.draw(renderer);renderer.restore();renderer.flush();runtime.resolveAnimationFrame();
fs.writeFileSync('shots/software-rive-390.png',canvas.toBuffer('image/png'));
console.log('software native Rive rendered');
sm.delete();artboard.delete();vmi.delete();file.delete();renderer.delete();
