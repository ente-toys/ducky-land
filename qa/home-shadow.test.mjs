import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {canSail} from '../src/gameplay/islands.js';
import {boatPin} from '../src/rendering/pixi/boat-blend.js';
const bundle=await build({entryPoints:['src/world/home/placements.js'],bundle:true,platform:'node',format:'esm',write:false});
const P=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const props=P.createPlacements();
for(const [id,foot,pixel] of [
 ['hamlet-petalpatch-birch-northeast',[94.28515625,3409.08203125],[54.28515625,3239.08203125]],
 ['hamlet-petalpatch-oak-northeast',[40.031640625,3419.8578125],[.031640625,3249.8578125]],
])test(`${id}: its ground shadow cannot paint over a passing boat passenger`,async()=>{
 const p=props.find(p=>p.id===id),rider=boatPin(...foot,0,{x:0,y:-50});
 assert.ok(canSail(...foot,'home'),'passenger position is legal');
 assert.ok(Math.abs(rider.x-pixel[0])<46&&pixel[1]>=rider.y-122&&pixel[1]<=rider.y-15,'shadow touches displayed passenger body');
 const w=p.width*p.scale,h=p.height*p.scale;
 let x=Math.floor((pixel[0]-p.x+p.anchor.x*w)/w*128);if(p.flip)x=127-x;
 const y=Math.floor((pixel[1]-p.y+p.anchor.y*h)/h*128);
 const alpha=async src=>(await sharp('public'+src).resize(128,128,{fit:'fill'}).ensureAlpha().raw().toBuffer())[(y*128+x)*4+3];
 assert.ok(await alpha(p.src)>0,'negative control: original combined art covers the passenger');
 assert.ok(await alpha(p.groundShadowSrc)>0,'preserve the authored shadow');
 assert.equal(await alpha(p.uprightSrc),0,'upright sprite contains no shadow at the passenger');
 assert.ok(readFileSync('src/rendering/pixi/engine.js','utf8').includes('this.ground.addChild(this.homeShadows)'),'shadow layer is below the water actors');
});
