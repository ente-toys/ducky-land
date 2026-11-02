import fs from 'node:fs';
import Rive from '@rive-app/canvas-advanced';
const r=await Rive({wasmBinary:fs.readFileSync('node_modules/@rive-app/canvas-advanced/rive.wasm')});
const m=new r.Mat2D();
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(m)), m, JSON.stringify(m));
