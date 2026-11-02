// Offline pixel verification with Rive's official Canvas2D WASM runtime.
// This is deliberately labelled separately from the real-browser verification.
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import Rive from '../.tools/node_modules/@rive-app/canvas-advanced/canvas_advanced.mjs';
import {CrowdBrain} from '../rive/web/brain.mjs';
const require=createRequire(import.meta.url),{createCanvas,Path2D,DOMMatrix,Image}=require('../.tools/node_modules/@napi-rs/canvas');
globalThis.Path2D=Path2D;globalThis.DOMMatrix=DOMMatrix;globalThis.Image=Image;
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rt=await Rive({wasmBinary:fs.readFileSync(path.join(root,'.tools/node_modules/@rive-app/canvas-advanced/rive.wasm'))});
const file=await rt.load(fs.readFileSync(path.join(root,'rive/web/ducky-land.riv')));
const solo=process.argv.includes('--poses');
const ab=file.artboardByName(solo?'Ducky':'Plaza');
const vm=file.defaultArtboardViewModel(ab).defaultInstance();
const sm=new rt.StateMachineInstance(ab.stateMachineByName(solo?'Ducky':'Plaza'),ab);
sm.bindViewModelInstance(vm);ab.bindViewModelInstance(vm);
const canvas=createCanvas(solo?713:1600,solo?937:1000),renderer=rt.makeRenderer(canvas);
const ctx=canvas.getContext('2d');
const layout=JSON.parse(fs.readFileSync(path.join(root,'rive/web/plaza-layout.json'))),brain=new CrowdBrain(layout);
function render(dt){sm.advanceAndApply(dt);renderer.clear();renderer.save();ab.draw(renderer);renderer.restore();renderer.flush();rt.resolveAnimationFrame();}
if(solo){
  for(const [name,action] of Object.entries({quack:2,sit:4,wave:5,look:6,preen:7,sleep:8})){
    vm.number('action').value=action;vm.number('cap').value=0;
    for(let i=0;i<40;i++)render(1/60);
    const out=createCanvas(713,937),c=out.getContext('2d');c.fillStyle='#FFF4C5';c.fillRect(0,0,713,937);c.drawImage(canvas,0,0);
    fs.writeFileSync(path.join(root,'evidence',name+'-runtime.png'),out.toBuffer('image/png'));
  }
}else{
 const slots=Array.from({length:32},(_,i)=>vm.viewModel('slot'+i));
 function sync(){
  const order=brain.renderSlots();
  for(let i=0;i<32;i++){
    const d=order[i];
    if(!d){slots[i].number('x').value=-2000;slots[i].number('y').value=-2000;continue;}
    for(const k of ['x','y','action','facing','cap','shades','acc','shoes','city'])slots[i].number(k).value=d[k];
    slots[i].number('isPlayer').value=d.player?1:0;slots[i].string('name').value=' '+d.name+' ';
  }
 }
 const video=process.argv.includes('--video');
 const fps=video?24:30;
 const ff=video?spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-vcodec','png','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-t','20',path.join(root,'evidence/crowd-runtime-20s.mp4')],{stdio:['pipe','inherit','inherit']}):null;
 for(let i=0;i<=20*fps;i++){
   if(i===4*fps)brain.quack();
   if(i===8*fps)brain.keys.add('d');
   if(i===8.5*fps)brain.keys.clear();
   if(i===11*fps)brain.startParty(brain.player);
   brain.update(1/fps);sync();render(1/fps);
   if(ff&&i<20*fps){const png=await canvas.encode('png');if(!ff.stdin.write(png))await once(ff.stdin,'drain');}
   if([0,5,8,12,16,20].includes(i/fps))fs.writeFileSync(path.join(root,'evidence',`runtime-${String(i/fps).padStart(2,'0')}s.png`),canvas.toBuffer('image/png'));
 }
 if(ff){ff.stdin.end();const [code]=await once(ff,'close');if(code)throw Error('ffmpeg failed: '+code);}
 fs.writeFileSync(path.join(root,'evidence/runtime-events.json'),JSON.stringify(brain.snapshot(),null,2));
}
console.log('Rendered native Rive pixels using Canvas2D WASM. Browser verification is separate.');
