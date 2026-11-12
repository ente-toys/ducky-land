import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapFor} from '../src/world/island-maps.js';
import {canSail,harborOf} from '../src/gameplay/islands.js';
const read=p=>JSON.parse(readFileSync(p)),A='public/pixi-art/themes/sunflower/',art=read(A+'art.json');
test('Sunbob ground uses one continuous drawing with real neighbouring bleed at every seam',()=>{
 let drawing;
 for(const t of art.ground.tiles){
  const s=readFileSync(A+t.src,'utf8');assert.equal(t.bleed,4);
  const vb=s.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  assert.deepEqual(vb,[t.x,t.y,t.width+4,t.height+4]);
  const body=s.slice(s.indexOf('>')+1);drawing??=body;assert.equal(body,drawing,t.src+' shares the world drawing');
  assert.ok(!/<(?:linear|radial)Gradient|<image\b/.test(s),'flat SVG only');
 }
 const fallback=readFileSync('public/pixi-art/globe/sunflower-ground.svg','utf8');assert.equal(fallback.slice(fallback.indexOf('>')+1),drawing);
 const w=mapFor('sunflower').world;
 assert.deepEqual([...new Set(w.pathWidths)].sort((a,b)=>a-b),[104,128]);
 assert.ok(art.decks.filter(d=>/arch-|bridge-(nw|se)/.test(d.src)).every(d=>d.overBoats));
});
test('Sunbob sea, ring river and both brooks form one harbour-accessible sailing network',()=>{
 const step=20,x0=-2400,y0=-1800,cols=640,rows=460,wet=new Uint8Array(cols*rows),seen=new Uint8Array(cols*rows);
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)wet[r*cols+c]=canSail(x0+c*step,y0+r*step,'blossom')?1:0;
 const h=harborOf('blossom').water,start=Math.round((h.y-y0)/step)*cols+Math.round((h.x-x0)/step),queue=[start];seen[start]=1;
 for(let k=0;k<queue.length;k++){const i=queue[k],r=i/cols|0,c=i%cols;for(const [dr,dc] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]){
  const nr=r+dr,nc=c+dc,j=nr*cols+nc;if(nr<0||nr>=rows||nc<0||nc>=cols||seen[j]||!wet[j])continue;seen[j]=1;queue.push(j);
 }}
 assert.equal(queue.length,wet.reduce((a,b)=>a+b,0),'every sailable sample connects to harbour');
 for(const [x,y] of [[4300,-450],[0,1500],[400,2860]])assert.ok(seen[Math.round((y-y0)/step)*cols+Math.round((x-x0)/step)],'river reachable '+x+','+y);
});
