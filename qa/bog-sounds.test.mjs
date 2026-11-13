import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudio} from '../src/rendering/pixi/audio.js';
import {BOG_SOUNDS,synthesizeBogSound,createBogSounds} from '../src/features/bog-combat/sounds.js';

const context={sampleRate:48000,createBuffer(channels,length,rate){const data=new Float32Array(length);return {length,sampleRate:rate,numberOfChannels:channels,getChannelData:()=>data};}};
test('every Bog sound is a finite, short, click-free reusable mono buffer',()=>{
  for(const [name,seconds]of Object.entries(BOG_SOUNDS)){
    const buffer=synthesizeBogSound(context,name),data=buffer.getChannelData(0);
    assert.equal(buffer.length,Math.ceil(seconds*48000));assert.equal(buffer.numberOfChannels,1);assert.ok(seconds<=.42);
    assert.equal(Math.abs(data[0]),0);assert.ok(Math.abs(data.at(-1))<.00001);
    let energy=0;for(const sample of data){assert.ok(Number.isFinite(sample)&&Math.abs(sample)<=1);energy+=sample*sample;}assert.ok(energy>1);
  }
  assert.equal(synthesizeBogSound(context,'unknown'),null);
});

test('Bog uses the island audio unlock, mute, active-source stopping and disposal',async()=>{
  const before={AudioContext:globalThis.AudioContext,fetch:globalThis.fetch};let created=0,started=0,stopped=0,closed=0,generated=0;
  class Context{
    constructor(){created++;this.sampleRate=48000;this.state='suspended';this.destination={};}
    async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){closed++;this.state='closed';}
    createBuffer(...args){generated++;return context.createBuffer(...args);}
    createBufferSource(){return {connect(){return this;},disconnect(){},start(){started++;},stop(){stopped++;this.onended?.();}};}
    createGain(){return {gain:{value:0},connect(){return this;},disconnect(){}};}
  }
  globalThis.AudioContext=Context;globalThis.fetch=async()=>({ok:false});
  try{
    let now=0;const audio=createAudio(),playSound=createBogSounds(audio,{now:()=>now});
    assert.equal(created,0);playSound('shot');assert.equal(started,0);
    await audio.prepare();assert.equal(created,1);assert.equal(started,0);
    await audio.unlock();assert.equal(created,1);assert.equal(generated,Object.keys(BOG_SOUNDS).length);
    now=1000;assert.equal(playSound('shot'),true);assert.equal(started,1);assert.equal(playSound('shot'),false);
    playSound('pickup');assert.equal(started,2);assert.equal(playSound('wat'),false);
    audio.toggle();assert.equal(audio.muted,true);assert.equal(stopped,2);
    now=2000;playSound('tag');assert.equal(started,2);audio.toggle();now=3000;playSound('tag');assert.equal(started,3);
    await audio.unlock();assert.equal(generated,Object.keys(BOG_SOUNDS).length,'samples are cached across unlocks');
    await audio.suspend();now=4000;playSound('respawn');assert.equal(started,3);
    await audio.resume();now=5000;playSound('respawn');assert.equal(started,4);
    audio.dispose();assert.equal(closed,1);now=6000;playSound('ghost');assert.equal(started,4);
  }finally{Object.assign(globalThis,before);}
});
