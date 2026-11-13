import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,fixture} from '../scripts/stargaze/render-harness.mjs';

test('the real canvas draws an endless sky after a long pan, with a way back to your star', () => {
  const h = harness();
  try {
    assert.equal(h.tag.hidden,false);
    const opening = Buffer.from(h.pixels());
    h.send('pointerdown',{pointerId:1,button:0,clientX:500,clientY:500});
    h.send('pointermove',{pointerId:1,clientX:-20000,clientY:500});
    h.send('pointerup',{pointerId:1,clientX:-20000,clientY:500});
    assert.equal(h.tag.dataset.away,'true');
    const far = Buffer.from(h.pixels());
    assert.notDeepEqual(far,opening);
    // Cyan points must still be visible long after leaving the finite GitHub population.
    let points=0;
    for(let i=0;i<far.length;i+=4) if(far[i+1]>65 && far[i+2]>65 && far[i+2]>far[i]*1.3) points++;
    assert.ok(points>100,'procedural sky never becomes an empty area');
    h.tag.dispatchEvent(new Event('click'));h.tick();
    assert.equal(h.tag.dataset.away,undefined);
    assert.equal(h.tag.hidden,false);
  } finally {h.dispose();}
  assert.equal(h.scheduled.size,0,'closing cancels animation frames');
});

test('keyboard zoom, touch pinch, cancellation and small screens keep the sky usable', () => {
  const h=harness({width:390,height:650});
  try {
    assert.equal(h.canvas.width,356);
    const initial=Buffer.from(h.pixels());
    assert.equal(h.send('keydown',{key:'+'}).defaultPrevented,true);
    assert.notDeepEqual(Buffer.from(h.pixels()),initial);
    h.send('pointerdown',{pointerId:1,button:0,clientX:110,clientY:150});
    h.send('pointerdown',{pointerId:2,button:0,clientX:210,clientY:150});
    h.send('pointermove',{pointerId:2,clientX:300,clientY:150});
    h.send('pointercancel',{pointerId:1,clientX:110,clientY:150});
    h.send('pointerup',{pointerId:2,clientX:300,clientY:150});
    h.send('keydown',{key:'Home'});
    h.resize(300,500);
    assert.equal(h.canvas.width,266);
    assert.ok(Number.parseFloat(h.tag.style.left)>0 && Number.parseFloat(h.tag.style.left)<266);
    h.view.setData({...fixture,me:{...fixture.me,starred:false},players:[],online:[]});h.tick();
    assert.equal(h.tag.hidden,true,'no personal star is invented for a visitor without a star');
  } finally {h.dispose();}
});

test('refresh preserves the camera, and reduced motion produces a still frame', () => {
  const h=harness();
  try {
    h.send('keydown',{key:'ArrowRight'});
    const left=h.tag.style.left,top=h.tag.style.top,before=Buffer.from(h.pixels());
    h.view.setData({...fixture,online:['1']});h.tick();
    assert.equal(h.tag.style.left,left);assert.equal(h.tag.style.top,top);
    assert.notDeepEqual(Buffer.from(h.pixels()),before,'the departing star loses its online glow and connection');
    const after=Buffer.from(h.pixels());h.tick(performance.now()+20000);
    assert.deepEqual(Buffer.from(h.pixels()),after,'no pulsing in reduced motion');
  } finally {h.dispose();}
});

const peerSky = {total:1,online:['2'],players:[['2','mallard']]};
const tap = (h,x,y,type='touch') => {
  h.send('pointerdown',{pointerId:10,button:0,pointerType:type,clientX:x,clientY:y});
  h.send('pointerup',{pointerId:10,pointerType:type,clientX:x,clientY:y});
};

test('tapping a person reveals their login, refresh updates it, and empty sky dismisses it', () => {
  const h=harness({data:peerSky});
  try {
    // With one star, the opening camera places it slightly left and below centre.
    const x=h.canvas.width*.38,y=h.canvas.height*.56;
    tap(h,x,y);
    assert.equal(h.nameTag.hidden,false);
    assert.equal(h.nameTag.textContent,'@mallard');
    h.view.setData({...peerSky,online:[],players:[['2','renamed-duck']]});h.tick();
    assert.equal(h.nameTag.textContent,'@renamed-duck','selection follows account identity across a rename');
    tap(h,h.canvas.width*.6,h.canvas.height*.5);
    assert.equal(h.nameTag.hidden,true);
    tap(h,x,y,'mouse');
    assert.equal(h.nameTag.textContent,'@renamed-duck','offline named stars remain selectable');
    assert.equal(h.nameTag.hidden,false);
    h.view.setData({total:1,online:[],players:[]});h.tick();
    assert.equal(h.nameTag.hidden,true,'a removed account does not leave a stale name');
    assert.equal(h.nameTag.textContent,'');
  } finally {h.dispose();}
});

test('dragging and cancelling a touch never open a name, and Enter can select a visible star', () => {
  const h=harness({data:peerSky});
  try {
    const x=h.canvas.width*.38,y=h.canvas.height*.56;
    h.send('pointerdown',{pointerId:1,button:0,clientX:x,clientY:y});
    h.send('pointercancel',{pointerId:1,clientX:x,clientY:y});
    assert.equal(h.nameTag.hidden,true);
    h.send('pointerdown',{pointerId:2,button:0,clientX:x,clientY:y});
    h.send('pointermove',{pointerId:2,clientX:x+25,clientY:y});
    h.send('pointerup',{pointerId:2,clientX:x+25,clientY:y});
    assert.equal(h.nameTag.hidden,true);
    assert.equal(h.send('keydown',{key:'Enter'}).defaultPrevented,true);
    assert.equal(h.nameTag.textContent,'@mallard');
    assert.equal(h.nameTag.hidden,false);
  } finally {h.dispose();}
});

test('name labels fit inside a small round lens and treat server names as plain text', () => {
  const h=harness({width:320,height:600,data:peerSky});
  try {
    h.nameTag.offsetWidth=190;h.nameTag.offsetHeight=52;
    h.view.setData({...peerSky,players:[['2','<img src=x onerror=alert(1)>']]});h.tick();
    tap(h,h.canvas.width*.38,h.canvas.height*.56);
    assert.equal(h.nameTag.textContent,'@<img src=x onerror=alert(1)>');
    assert.equal(h.nameTag.hidden,false);
    const x=parseFloat(h.nameTag.style.left),y=parseFloat(h.nameTag.style.top),half=h.canvas.width/2;
    for(const dx of [-95,95]) for(const dy of [-26,26]) {
      assert.ok(Math.hypot(x+dx-half,y+dy-half)<=half-11,'all label corners remain inside the eyepiece');
    }
    h.send('pointerdown',{pointerId:1,button:0,clientX:150,clientY:150});
    h.send('pointermove',{pointerId:1,clientX:5000,clientY:150});
    h.send('pointerup',{pointerId:1,clientX:5000,clientY:150});
    assert.equal(h.nameTag.hidden,true,'the selected label leaves the view with its star');
  } finally {h.dispose();}
});
