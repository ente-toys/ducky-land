import test from 'node:test';
import assert from 'node:assert/strict';
import {geometry, inPoly, inShape} from '../assets/world/island-geometry.mjs';
import {HOME_MAP, mapFor, readyThemes} from '../src/world/island-maps.js';

const maps = () => [HOME_MAP, ...readyThemes().map(mapFor)];
const random = () => {let n=19;return () => ((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);};

function boundsFor(shape, padding) {
  if (!shape.poly) {
    const rx = Math.abs(shape.rx + padding);
    const ry = Math.abs(shape.ry + padding);
    return [shape.x - rx, shape.y - ry, shape.x + rx, shape.y + ry];
  }

  const margin = Math.max(0, padding);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const polygon of [shape.poly, ...(shape.parts ?? [])]) {
    for (const [x,y] of polygon) {
      minX = Math.min(minX,x);
      minY = Math.min(minY,y);
      maxX = Math.max(maxX,x);
      maxY = Math.max(maxY,y);
    }
  }
  return [minX-margin, minY-margin, maxX+margin, maxY+margin];
}

function shapeChecker(shapes, paddingFor) {
  // Reject distant points with independent bounds before testing polygon edges.
  const bounded = shapes.map(shape => {
    const padding = paddingFor(shape);
    return {shape, padding, bounds: boundsFor(shape,padding)};
  });
  return (x,y) => bounded.some(({shape,padding,bounds:[minX,minY,maxX,maxY]}) =>
    x>=minX && x<=maxX && y>=minY && y<=maxY && inShape(x,y,shape,padding));
}

function makeReference(world) {
  const inWater = shapeChecker(world.water, () => 20);
  const inObstacle = shapeChecker(world.obstacles, o => o.clearance ?? 16);
  return (x,y) => {
    if (!Number.isFinite(x)||!Number.isFinite(y)) return false;
    if (!inPoly(x,y,world.coast)) {
      const deck=world.walkways.some(({a,b,w})=>{
        const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
        return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)<w/2-10;
      });
      const islet=world.islets.some(([cx,cy,rx,ry])=>((x-cx)/(rx-20))**2+((y-cy)/(ry-20))**2<1);
      const land=(world.lands??[]).some(poly=>inPoly(x,y,poly));
      if (!deck&&!islet&&!land) return false;
    }
    const bridge=world.bridges.some(b=>b.poly?inShape(x,y,b,-8):Math.abs(x-b.x)<b.w/2-8&&Math.abs(y-b.y)<b.h/2-12);
    return (bridge || !inWater(x,y)) && !inObstacle(x,y);
  };
}

test('accelerated walking geometry matches reference collision checks across all maps',()=>{
  const rnd=random();
  for (const map of maps()) {
    const world=map.walk,{walkable}=geometry(world),origin=map.origin;
    const reference = makeReference(world);
    const points=Array.from({length:800},()=>[origin.x+rnd()*map.width,origin.y+rnd()*map.height]);
    for (const b of world.bridges) {
      for(const p of b.poly??[])for(const delta of [-.001,0,.001])points.push(p.map(v=>v+delta));
      for (const dx of [0,-b.w/2+8,b.w/2-8]) for (const dy of [0,-b.h/2+12,b.h/2-12]) {
        for (const delta of [-.001,0,.001]) points.push([b.x+dx+delta,b.y+dy+delta]);
      }
    }
    for (const [x,y] of points) assert.equal(walkable(x,y),reference(x,y),`${map.id} at ${x},${y}`);
  }
});

test('smoothed community routes keep every leg clear and finish at their requested walking target',()=>{
  const rnd=random();
  for (const map of maps()) {
    const nav=map.nav();let checked=0;
    for (let k=0;k<300&&checked<20;k++) {
      const tx=map.spawn.x+(rnd()*2-1)*1400,ty=map.spawn.y+(rnd()*2-1)*980;
      if (!nav.walkable(tx,ty)) continue;
      const path=nav.route(map.spawn.x,map.spawn.y,tx,ty);
      if (!path.length) continue;
      let at=[map.spawn.x,map.spawn.y];
      for (const point of path) {assert.ok(nav.clearLine(at,point),`${map.id}: blocked route leg ${at} to ${point}`);at=point;}
      assert.deepEqual(at,[tx,ty],`${map.id}: final target preserved`);checked++;
    }
    assert.equal(checked,20,`${map.id}: twenty complete routes`);
  }
});
