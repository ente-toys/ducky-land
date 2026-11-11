import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

test('Library overview has transparent open sea instead of an opaque tile rectangle',async()=>{
  for(const suffix of ['','-ground']){
    const {data,info}=await sharp(`public/pixi-art/globe/library${suffix}.svg`).resize(128,128,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const alpha=(x,y)=>data[(y*info.width+x)*4+3];
    for(const [x,y] of [[0,0],[127,0],[0,127],[127,127],[64,0],[64,127]])assert.equal(alpha(x,y),0,`${suffix}: open ocean at ${x},${y}`);
    let land=0;for(let i=3;i<data.length;i+=4)if(data[i]>200)land++;
    assert(land>128*128*.15,'authored island remains visible');
  }
});
