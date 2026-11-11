import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameClock} from '../src/pixi/frame-clock.js';
import {followPosition} from '../src/pixi/follow-camera.js';

test('native frame clock reduces timestamp jitter without freezing or drifting from real time',()=>{
  for(const hz of [60,75,120]){
    const clock=createFrameClock();let previous=clock(0),rawPrevious=0,rawError=0,smoothError=0;
    for(let i=1;i<=hz*5;i++){
      const raw=i*1000/hz+Math.sin(i*2.4)*.9,smooth=clock(raw);
      assert.ok(smooth>previous);assert.ok(Math.abs(raw-smooth)<1000/hz/2);
      if(i>hz){rawError+=Math.abs(raw-rawPrevious-1000/hz);smoothError+=Math.abs(smooth-previous-1000/hz);}
      previous=smooth;rawPrevious=raw;
    }
    assert.ok(smoothError<rawError*.4);
  }
});

test('a real dropped frame advances time, follow catches up, and zoom can resume from the same position',()=>{
  const clock=createFrameClock();let state=followPosition(null,{x:0,y:0},clock(0));
  for(let i=1;i<=120;i++)state=followPosition(state,{x:245*i/60,y:0},clock(i*1000/60));
  const before=state;
  state=followPosition(state,{x:245*2.05,y:0},clock(2050));
  assert.ok(state.x>before.x);assert.ok(state.x<245*2.05);
  const resumed=clock(10000);assert.ok(resumed>=10000);
  state=followPosition(state,{x:700,y:0},resumed);assert.equal(state.x,700);
});
