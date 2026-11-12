import test from 'node:test';
import assert from 'node:assert/strict';
import {followPosition} from '../src/rendering/shared/follow-camera.js';

test('Shift-running camera advances steadily at different display refresh rates',()=>{
  const ends=[];
  for(const hz of [60,75,120]){
    let state=followPosition(null,{x:0,y:0},0);
    for(let i=1;i<=hz*3;i++){
      const next=followPosition(state,{x:416.5*i/hz,y:0},i*1000/hz);
      assert.ok(next.x>state.x);
      if(i>hz)assert.ok(Math.abs((next.x-state.x)*hz-416.5)<.01);
      state=next;
    }
    ends.push(state.x);
  }
  assert.ok(Math.max(...ends)-Math.min(...ends)<1e-6);
});

test('small position reversals are absorbed while moving and stops settle without overshoot',()=>{
  let state=followPosition(null,{x:0,y:0},0);
  for(let i=1;i<=120;i++)state=followPosition(state,{x:i*5,y:0},i*1000/60);
  const corrected=followPosition(state,{x:598,y:0},121*1000/60);
  assert.ok(corrected.x>state.x,'small backward corrections do not reverse the camera');
  state=corrected;
  for(let i=122;i<=240;i++){
    const next=followPosition(state,{x:598,y:0},i*1000/60);
    assert.ok(next.x>=state.x&&next.x<=598);state=next;
  }
  assert.ok(598-state.x<1e-6);
  assert.equal(followPosition(state,{x:2000,y:0},4100).x,2000);
});
