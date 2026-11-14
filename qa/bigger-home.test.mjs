import test from 'node:test';
import assert from 'node:assert/strict';
import expansion from '../src/world/home/home-expansion.json' with {type:'json'};
import original from '../src/world/home/home-original-world.json' with {type:'json'};
import {HOME_MAP,mapOf} from '../src/world/island-maps.js';
import {canSail,boardingPoint,originOffset,landingSpot} from '../src/gameplay/islands.js';
import {WORLD_ISLANDS,offsetOf} from '../src/world/world-map.js';
import {MUSEUM_DOOR} from '../src/gameplay/player-motion.js';

test('bigger Home retains original landmark and save coordinates, every community connects to the plaza',()=>{
  const m=HOME_MAP,n=m.nav();
  assert.deepEqual(m.spawn,{x:2820,y:2600},'spawn clears the traced plaza bench');
  assert.equal(m.spawn.x,original.zones.plaza.spawn[0]);
  assert.equal(m.spawn.y,original.zones.plaza.spawn[1]-40,'only the spawn moves, scenery and saved coordinates stay fixed');
  assert.ok(n.walkable(m.spawn.x,m.spawn.y));
  assert.deepEqual(m.world.props,original.props);
  assert.ok(n.walkable(MUSEUM_DOOR.out.x,MUSEUM_DOOR.out.y));
  for(const {id,point} of expansion.places){
    assert.ok(n.walkable(...point),id+' stands on clear ground');
    const route=n.route(m.spawn.x,m.spawn.y,...point);
    assert.deepEqual(route.at(-1),point,id+' is reachable');
    let prev=[m.spawn.x,m.spawn.y];for(const p of route){assert.ok(n.clearLine(prev,p),id+' has no blocked route segment');prev=p;}
  }
  const west=[-544,2033],north=[2900,-77];
  const approaches=[west,north].map(point=>n.nearest(...point,180));
  for(const point of approaches)assert.ok(point,'nearby saved-coordinate approach survives restored scenery');
  assert.deepEqual(n.route(...approaches[0],...approaches[1]).at(-1),approaches[1]);
});

test('bigger Home has ten afloat moorings, walkable boarding points and usable west-coast docking',()=>{
  const n=HOME_MAP.nav();assert.equal(HOME_MAP.boatSpots().length,10);
  for(const b of HOME_MAP.boatSpots()){
    assert.ok(canSail(b.x,b.y),'mooring is clear of shore');
    const p=boardingPoint({...b,islandId:'home'});assert.ok(n.walkable(p.x,p.y));
  }
  const dock=landingSpot({islandId:'home',...HOME_MAP.boatSpots()[5]});
  assert.ok(dock&&dock.x<0,'negative coast positions can be docked');
});

test('Home expansion snapshots fit GPU-safe tiles and retain the exact island coordinate transform',()=>{
  assert.ok(expansion.origin.x<0&&expansion.origin.y<0);
  for(const t of expansion.tiles)assert.ok(t.width<=1536&&t.height<=1536);
  assert.equal(expansion.tiles.reduce((sum,t)=>sum+t.width*t.height,0),expansion.width*expansion.height);
  for(const other of WORLD_ISLANDS.filter(i=>i.id!=='home')){
    const m=mapOf(other.id),o=originOffset('home',other.id),delta=offsetOf('home',other.id);
    assert.ok(Math.abs(o.x+m.cx-HOME_MAP.cx-delta.x)<1e-8);
    assert.ok(Math.abs(o.y+m.cy-HOME_MAP.cy-delta.y)<1e-8);
  }
});
