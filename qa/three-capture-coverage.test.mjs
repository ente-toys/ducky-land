import test from 'node:test';
import assert from 'node:assert/strict';
import {captureCoverage} from '../src/pixi/three-capture-coverage.js';
import {detailSize} from '../src/pixi/three-detail-view.js';

test('rolled captures cover every viewport corner from upright through half turn, including ultrawide and portrait',()=>{
 for(const aspect of [.2,.4,9/16,1,16/9,21/9,4,8])for(let step=0;step<=360;step++){
  const heading=step*Math.PI/360,scale=captureCoverage(aspect,heading),c=Math.cos(heading),s=Math.sin(heading);
  for(const x of [-aspect,aspect])for(const y of [-1,1]){
   const u=x*c-y*s,v=x*s+y*c;
   assert.ok(Math.abs(u)<=aspect*scale+1e-10,`${aspect}/${heading}: horizontal corner escaped`);
   assert.ok(Math.abs(v)<=scale+1e-10,`${aspect}/${heading}: vertical corner escaped`);
  }
 }
});

test('coverage is continuous, symmetric and keeps a minimum padded capture at settled heading',()=>{
 for(const aspect of [.25,1,4]){
  assert.equal(captureCoverage(aspect,0),1.5);
  assert.ok(Math.abs(captureCoverage(aspect,Math.PI)-1.5)<1e-12);
  for(const heading of [.01,.3,.8,1.4]){
   assert.equal(captureCoverage(aspect,heading),captureCoverage(aspect,-heading));
   assert.ok(Math.abs(captureCoverage(aspect,heading)-captureCoverage(1/aspect,heading))<1e-12);
   assert.ok(Math.abs(captureCoverage(aspect,heading+1e-7)-captureCoverage(aspect,heading))<1e-5);
  }
 }
 assert.ok(captureCoverage(4,70*Math.PI/180)>4,'fixed 1.5 overscan cannot cover a steeply rolled ultrawide viewport');
});

test('adaptive world-space coverage leaves the 1536-pixel capture budget intact at every heading',()=>{
 for(const [width,height]of [[3840,2160],[5120,1440],[1440,5120],[6000,750],[750,6000]])for(const dpr of [1,2,3]){
  const size=detailSize(width,height,dpr);
  assert.ok(Math.max(size.width,size.height)<=1536);
  for(const heading of [0,.3,Math.PI/2,Math.PI]){
   const scale=captureCoverage(width/height,heading);
   assert.ok(scale>=1.5);
   assert.deepEqual(detailSize(width,height,dpr),size,'coverage must not enlarge the render target');
  }
 }
 assert.throws(()=>captureCoverage(0,0),RangeError);
 assert.throws(()=>captureCoverage(1,NaN),RangeError);
});

test('the flattened capture uses more pixels while keeping the feather past the viewport',()=>{
 for(const [width,height] of [[1400,1000],[1536,864],[393,852]]){
  const minPixels=Math.min(width,height),edge=Math.min(.12,48/minPixels);
  const scale=captureCoverage(width/height,0,1,minPixels);
  assert.ok(scale<1.5);
  assert.ok(.5-.5/scale>=edge-1e-12);
 }
});
