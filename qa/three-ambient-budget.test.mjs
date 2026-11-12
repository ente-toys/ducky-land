import test from 'node:test';
import assert from 'node:assert/strict';
import {AmbientDrawClock,RenderDemand} from '../src/rendering/three/three-render-demand.js';
test('independent ambient updates share at most thirty globe draws each second',()=>{
 const clock=new AmbientDrawClock();let draws=0;
 for(let ms=0;ms<1000;ms++)if(clock.update(ms,ms%33===0||ms%50===0))draws++;
 assert.ok(draws<=31,draws);assert.ok(draws>=25,draws);
 const queued=new AmbientDrawClock();assert.equal(queued.update(0,true),true);assert.equal(queued.update(8,true),false);
 assert.equal(queued.update(40,false),true,'last queued change is preserved');
 assert.equal(queued.update(80,false),false,'no ambient redraw when unchanged');
});
test('camera and live captures still render without waiting for the ambient clock',()=>{
 const clock=new AmbientDrawClock(),demand=new RenderDemand();demand.consume();
 assert.equal(clock.update(0,true),true);assert.equal(clock.update(8,true),false);
 assert.equal(demand.consume(true),true);demand.invalidate();assert.equal(demand.consume(),true);
});
