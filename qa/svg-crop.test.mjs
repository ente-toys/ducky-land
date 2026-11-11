import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {cropSVG} from '../src/pixi/theme-raster.js';
import {cropFairSVG} from '../src/pixi/fair-raster.js';

const original=`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="10 20 20 10" fill="#cb7139"><style>.ink{fill:#39472d}</style><rect x="15" y="22" width="10" height="6"/><rect class="ink" x="19" y="22" width="2" height="6"/></svg>`;
for(const [name,crop] of [['theme',cropSVG],['fair',cropFairSVG]])test(`${name} fractional crop preserves styles, nonzero viewBox and transparent margins`,async()=>{
 const viewport=[200,100,25.5,10.5,149,79];
 const {data,info}=await sharp(Buffer.from(crop(original,viewport))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,149);assert.equal(info.height,79);
 const pixel=(x,y)=>[...data.subarray((y*info.width+x)*4,(y*info.width+x)*4+4)];
 assert.equal(pixel(0,0)[3],0);assert.equal(pixel(148,78)[3],0);
 assert.deepEqual(pixel(40,30),[203,113,57,255]);assert.deepEqual(pixel(74,30),[57,71,45,255]);
});
test('device density rounds canvas dimensions without moving crop geometry',async()=>{
 const svg=cropSVG(original,[200,100,25.5,10.5,149.25,79.25],3.625);
 const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,Math.ceil(149.25*3.625));assert.equal(info.height,Math.ceil(79.25*3.625));
 const pixel=(x,y)=>[...data.subarray((y*info.width+x)*4,(y*info.width+x)*4+4)];
 assert.equal(pixel(0,0)[3],0);
 assert.deepEqual(pixel(Math.round(info.width/2),Math.round(info.height/2)),[57,71,45,255]);
});
