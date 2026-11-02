import fs from 'node:fs';
import Rive from '@rive-app/canvas-advanced';
const rt=await Rive({wasmBinary:fs.readFileSync('node_modules/@rive-app/canvas-advanced/rive.wasm')});
const file=await rt.load(fs.readFileSync('rive/web/ducky-land.riv'),undefined,false),art=file.artboardByName('Race Cards'),source=art.animationByName('Countdown'),anim=new rt.LinearAnimationInstance(source,art);
console.log({prototype:Object.getOwnPropertyNames(Object.getPrototypeOf(anim)),duration:anim.duration,fps:anim.fps,time:anim.time,sourceDuration:source.duration,sourceFPS:source.fps});
anim.advance(1);console.log({time:anim.time});
