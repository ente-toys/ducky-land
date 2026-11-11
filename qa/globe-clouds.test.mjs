import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudState,CLOUD_ROTATION_RATE} from '../src/pixi/globe-clouds.js';

test('clouds fade away before island detail and reach full coverage on the globe',()=>{
  assert.equal(cloudState(0,10).fade,0);
  assert.equal(cloudState(.35,10).fade,0);
  assert.equal(cloudState(.6,10).fade,.5);
  assert.equal(cloudState(1,10).fade,1);
});

test('cloud rotation retains the Three atmosphere speed and respects reduced motion',()=>{
  assert.equal(cloudState(1,100).phase,100*CLOUD_ROTATION_RATE);
  const period=2*Math.PI/CLOUD_ROTATION_RATE;
  assert.ok(Math.abs(cloudState(1,period+100).phase-cloudState(1,100).phase)<1e-12);
  assert.deepEqual(cloudState(1,100,true),{phase:0,fade:1});
});
