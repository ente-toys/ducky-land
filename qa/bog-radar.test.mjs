import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {placeBogRadar, BOG_RADAR_ICON, BOG_RADAR_ISLAND, BOG_RADAR_SIZE_PX} from '../src/features/bog-combat/bog-radar.js';
import {nearbyMapFrame} from '../src/app/nearby-map.js';
import {mapOf} from '../src/world/island-maps.js';
import {mapPoint, viewFrame} from '../src/world/sphere-coordinates.js';
import {logMap} from '../src/world/sphere.js';
import {worldIsland, WORLD_GEO} from '../src/world/world-map.js';

const close = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`);
const bog = mapOf(BOG_RADAR_ISLAND);
const radius = (500 + 2 * 1000 / (132 - 8)) * 8;

test('Bog badge preserves the true in-range terrain position, using caller-owned storage', () => {
  const out = {x:0,y:0,visible:false};
  assert.equal(placeBogRadar(out,'home',100,-200,radius),out);
  assert.deepEqual(out,{x:100,y:-200,visible:true});
  const point = mapPoint(BOG_RADAR_ISLAND,'home',{x:bog.cx+1000,y:bog.cy-500});
  const terrain = nearbyMapFrame('home',point,out,radius).find(i=>i.id===BOG_RADAR_ISLAND);
  assert.ok(terrain);
  close(out.x,terrain.x); close(out.y,terrain.y);
  assert.equal(out.visible,true);
});

test('out-of-range Bog stays centred on the outline in its projected direction, even outside the three nearest islands', () => {
  const out = {x:0,y:0,visible:false};
  for (const id of ['home','blossom','sunset','isle-251','isle-250','isle-55']) {
    const m = mapOf(id), point = {x:m.cx+350,y:m.cy-270};
    const terrain = nearbyMapFrame(id,point,out,radius);
    const q = logMap(viewFrame(id,point),worldIsland(BOG_RADAR_ISLAND).center,WORLD_GEO.Rw);
    close(Math.hypot(out.x,out.y),radius);
    close(out.x / radius,q.x / Math.hypot(q.x,q.y));
    close(out.y / radius,q.y / Math.hypot(q.x,q.y));
    assert.equal(out.visible,true);
    if (id==='home') assert.ok(!terrain.some(i=>i.id===BOG_RADAR_ISLAND));
  }
  for (const [x,y] of [[10000,0],[-10000,0],[0,10000],[0,-10000],[9000,-7000],[-9000,7000]]) {
    placeBogRadar(out,'home',x,y,radius);
    close(Math.hypot(out.x,out.y),radius);
    close(out.x*y-out.y*x,0);
    assert.ok(out.x*x+out.y*y>0);
  }
});

test('minimap uses the border centre for the badge and clips terrain independently', () => {
  const source = readFileSync(new URL('../src/app/WorldMap.jsx',import.meta.url),'utf8');
  const css = readFileSync(new URL('../src/app/pixi.css',import.meta.url),'utf8');
  assert.match(source,/const outlineRadius = width \/ 2 \+ 2 \* iconSize \/ BOG_RADAR_SIZE_PX/);
  assert.match(source,/outlineRadius \/ scale/);
  assert.match(source,/<g clipPath="url\(#pixi-world-map-terrain-clip\)">/);
  assert.ok(source.indexOf('</g>\n      {frame.bogVisible') > source.indexOf('<g clipPath='));
  assert.match(css,/\.pixi-world-map \{[^}]*overflow: visible;/);
  assert.match(css,/\.pixi-world-map svg \{ overflow: visible; \}/);
});

test('Bog badge hides on the Bog, including at its centre, and reappears after leaving', () => {
  const out = {x:0,y:0,visible:true};
  for (const point of [{x:bog.cx,y:bog.cy},bog.HARBOR.land]) {
    nearbyMapFrame(BOG_RADAR_ISLAND,point,out,radius);
    assert.equal(out.visible,false);
    assert.ok(Number.isFinite(out.x+out.y));
  }
  const home=mapOf('home');
  nearbyMapFrame('home',{x:home.cx,y:home.cy},out,radius);
  assert.equal(out.visible,true);
});

test('approved badge is served locally and all six choices are swappable by the one icon constant', () => {
  assert.equal(BOG_RADAR_SIZE_PX,38);
  assert.equal(BOG_RADAR_ICON,'/pixi-art/radar-marker/02-white-badge.svg');
  for (const file of ['01-gun-alone','02-white-badge','03-gta-circle','04-map-pin','05-paint-splat','06-team-split']) {
    assert.match(readFileSync(new URL(`../public/pixi-art/radar-marker/${file}.svg`,import.meta.url),'utf8'),/<svg/);
  }
});
