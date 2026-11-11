import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameMetrics} from '../src/pixi/frame-metrics.js';

test('GPU queries are asynchronous, distinguish draw time from CPU and RAF cadence, and discard disjoint samples',()=>{
  let time=0,available=false,lost=false,id=0;const deleted=[];
  const ext={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2};
  const gl={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,CURRENT_QUERY:5,getExtension:()=>ext,getParameter:()=>lost,getQuery:()=>null,createQuery:()=>({id:++id}),beginQuery(){},endQuery(){},deleteQuery:q=>deleted.push(q),getQueryParameter(q,key){if(key===3)return available;assert(available,'must not block on a pending GPU query');return 6e6;}};
  const metrics=createFrameMetrics(gl,{now:()=>time,sampleEvery:1});
  let token=metrics.begin(0);time=2;metrics.end(token,'moving');
  let group=metrics.summary().groups.moving;assert.equal(group.cpuMs.mean,2);assert.equal(group.gpuMs,null);
  available=true;group=metrics.summary().groups.moving;assert.equal(group.gpuMs.mean,6);assert.equal(deleted.length,1);
  token=metrics.begin(16.667);time=4;metrics.end(token,'moving');lost=true;
  const summary=metrics.summary();assert.equal(summary.disjointSamples,1);assert.equal(summary.groups.moving.gpuMs.samples,1);assert.equal(summary.groups.moving.rafIntervalMs.mean,16.667);metrics.destroy();
});

test('GPU fence fallback reports an upper bound honestly and never waits for completion',()=>{
  let time=0,ready=false;
  const gl={SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,WAIT_FAILED:3,getExtension:()=>null,fenceSync:()=>({}),flush(){},deleteSync(){},clientWaitSync(fence,flags,timeout){assert.equal(timeout,0);return ready?4:2;}};
  const metrics=createFrameMetrics(gl,{now:()=>time,sampleEvery:1});
  const token=metrics.begin(0);time=2;metrics.end(token,'globe');
  assert.equal(metrics.summary().groups.globe.gpuCompletionUpperBoundMs,null);
  ready=true;time=10;const summary=metrics.summary();assert.equal(summary.gpuTimerSupported,false);assert.equal(summary.groups.globe.gpuMs,null);assert.equal(summary.groups.globe.gpuCompletionUpperBoundMs.mean,8);metrics.destroy();
});

test('CPU-only devices do not invent a GPU duration',()=>{
  const metrics=createFrameMetrics(null,{now:()=>1});metrics.end(metrics.begin(0),'idle');
  const summary=metrics.summary();assert.equal(summary.gpuTimerSupported,false);assert.equal(summary.groups.idle.gpuMs,null);metrics.destroy();
});

test('background GPU upload work is measured separately without changing frame cadence',()=>{
 let time=0;const metrics=createFrameMetrics(null,{now:()=>time});
 let token=metrics.begin(0);time=2;metrics.end(token,'moving');
 token=metrics.beginWork();time=5;metrics.end(token,'upload');
 token=metrics.begin(16);time=7;metrics.end(token,'moving');
 const summary=metrics.summary();assert.equal(summary.groups.moving.rafIntervalMs.mean,16);assert.equal(summary.groups.upload.cpuMs.mean,3);assert.equal(summary.groups.upload.uploads,1);metrics.destroy();
});
