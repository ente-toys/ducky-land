import test from 'node:test';
import assert from 'node:assert/strict';
import {detailWork,detailMovement} from '../src/rendering/three/three-detail-budget.js';

test('a settled island selection and the next wider zoom keep live detail',()=>{
  assert.deepEqual(detailWork(1.2),{visible:false,preload:false,hz:20});
  assert.deepEqual(detailWork(2,false,true),{visible:false,preload:true,hz:20},'a selected island starts loading during the flight');
  assert.deepEqual(detailWork(1.1),{visible:false,preload:true,hz:20});
  assert.deepEqual(detailWork(.65),{visible:true,preload:true,hz:30});
  assert.deepEqual(detailWork(.65*Math.exp(.24)),{visible:true,preload:true,hz:30});
  assert.equal(detailWork(.35).hz,60,'the blended handoff updates the capture at display cadence');
  assert.equal(detailWork(.16).hz,60,'native walking and the final zoom retain display cadence');
});

test('capture hysteresis prevents repeated scene switching near the approach boundary',()=>{
  let visible=false,changes=0;
  for(const altitude of [.91,.89,.91,.89,.93,.97,.99,1.01]){
    const next=detailWork(altitude,visible).visible;
    if(next!==visible)changes++;
    visible=next;
  }
  assert.equal(changes,2,'one enter and one exit despite boundary oscillation');
});

test('orbit and preview approach do no animated capture work while prediction remains scheduled',()=>{
  let nativeVisualFrames=0,predictionTicks=0,preloads=0;
  for(let i=0;i<600;i++){
    const altitude=1.79-.89*i/599;
    const work=detailWork(altitude);
    nativeVisualFrames+=Number(work.visible);
    predictionTicks+=work.hz/60;
    preloads+=Number(work.preload);
  }
  assert.equal(nativeVisualFrames,0,'the old <1.8 path would render and upload on every scheduled tick here');
  assert.ok(predictionTicks>199&&predictionTicks<201,'simulation still receives 20Hz callbacks');
  assert.ok(preloads>0,'art can begin loading before a live canvas is needed');
});

test('overview and emote shortcuts cannot reactivate follow and cancel world zoom',()=>{
  for(const key of ['0','q','e','m',' ','shift','1'])assert.equal(detailMovement(new Set([key])),false,key);
  assert.equal(detailMovement(new Set(['w'])),true);
  assert.equal(detailMovement(new Set(['arrowright'])),true);
  assert.equal(detailMovement(new Set(['a','d'])),false);
  assert.equal(detailMovement(new Set(),{x:.5,y:0}),true);
});
