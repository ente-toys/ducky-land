import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
const base='public/pixi-art/themes/snow/';
const art=JSON.parse(readFileSync(base+'art.json'));
for(const id of ['bakery','final-grove-0-tree-0','bakery-yard-bench-5','lake-warming-hut'])test(`Iceland streamed SVG preserves ${id} source pixels and inherited styles`,async()=>{
 const p=art.props.find(p=>p.id===id),text=readFileSync(base+p.src,'utf8');
 const root=text.slice(0,text.indexOf('>')+1).replace(/\s(?:width|height)="[^"]*"/g,'').replace('<svg',`<svg width="${p.width}" height="${p.height}"`);
 const full=`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(p.width)}" height="${Math.ceil(p.height)}">${root}${text.slice(text.indexOf('>')+1)}</svg>`;
 const tile=p.tiles.find(t=>t.width===256&&t.height===256&&t.y>0)??p.tiles[0];
 const expected=await sharp(Buffer.from(full)).extract({left:tile.x,top:tile.y,width:Math.round(tile.width),height:Math.round(tile.height)}).ensureAlpha().raw().toBuffer();
 const actual=await sharp(base+tile.src).ensureAlpha().raw().toBuffer();
 assert.equal(actual.length,expected.length);let sum=0;
 for(let i=0;i<actual.length;i++)sum+=Math.abs(actual[i]-expected[i]);
 // A fractional final tile dimension rounds to the nearest native raster pixel.
 const tolerance=tile.width%1||tile.height%1?2:.2;
 assert.ok(sum/actual.length<tolerance,`mean channel error ${sum/actual.length}`);
});
