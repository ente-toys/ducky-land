import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {frontBodyMask} from '../scripts/lib/front-body-mask.mjs';
import {HOME_DUCK_BODY} from '../src/world/home/duck-body.js';
import {inShape} from '../assets/world/island-geometry.mjs';
import {OUTFIT_OPTIONS} from '../src/gameplay/outfits.js';

test('Home standing box contains every direction and allowed hat frame with motion allowance',()=>{
  const m=JSON.parse(readFileSync('public/pixi-duck/manifest.json'));
  const k=m.scale*.88*.24*3;
  let half=0,height=0;
  for(const v of m.views)for(const p of v.parts.filter(p=>p.role!=='shadow')){
    half=Math.max(half,Math.abs(p.bounds[0]-v.ground[0])*k,Math.abs(p.bounds[2]-v.ground[0])*k);
    height=Math.max(height,(v.ground[1]-p.bounds[1])*k);
  }
  for(const e of m.wardrobe.filter(e=>e.slot==='cap'&&OUTFIT_OPTIONS.cap.includes(e.index)))for(const frames of Object.values(e.frames))for(const f of frames)if(f.visible){
    half=Math.max(half,Math.abs(f.rect[0])*k,Math.abs(f.rect[0]+f.rect[2])*k);
    height=Math.max(height,-f.rect[1]*k);
  }
  assert.ok(HOME_DUCK_BODY.width/2>=half+4);
  assert.ok(HOME_DUCK_BODY.height>=height+8);
});

test('front mask dilates sideways/downwards, preserves recesses, flips, and stops at render sortY',()=>{
  const n=256,rgba=new Uint8Array(n*n*4);
  // One cell near the left edge, and a lower isolated detail setting render depth.
  rgba[(40*n+30)*4+3]=255;rgba[(230*n+220)*4+3]=255;
  for(const flip of [false,true]){
    const p={width:256,height:256,scale:1,x:0,y:0,anchor:{x:0,y:0},flip};
    const rings=frontBodyMask(rgba,p,231),shape={poly:rings[0],parts:rings.slice(1)};
    const x=flip?-30.5:30.5;
    assert.ok(inShape(x+79,120,shape));
    assert.ok(inShape(x,230,shape),'downward dilation');
    assert.equal(inShape(x,232,shape),false,'prop behind Duck has no body block');
    assert.equal(inShape(x,39,shape),false,'does not extend upwards');
    assert.equal(inShape(x-100,120,shape),false,'open side stays open');
  }
});
