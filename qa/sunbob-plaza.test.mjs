import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapOf} from '../src/pixi/island-maps.js';
import {IslandRoom} from '../worker/index.js';
import {setWalkDestination,walkStep} from '../src/pixi/player-motion.js';
import {createNavigation} from '../src/pixi/navigation.js';
import {auditBloom,bloomApproaches,bloomBlockers,bloomFloor} from './sunbob-plaza-audit.mjs';

const map=mapOf('blossom');
const client=map.nav(),authority=IslandRoom.prototype.navFor.call({},'blossom');
test('the bloom audit catches the stale raised-plaza collisions from the reported preview',()=>{
  const centre=JSON.parse(readFileSync(new URL('../public/pixi-art/themes/sunflower/bloom/centre-placements.json',import.meta.url)));
  const stale=centre.retireObstacleRecords.filter(o=>o.name==='step rings');
  assert.equal(stale.length,4);
  const report=auditBloom(createNavigation({...map.walk,obstacles:[...map.walk.obstacles,...stale]}));
  assert.ok(report.blocked.length>2800,'old step rings obstruct the new paving');
  assert.ok(report.failed.length>0,'old step rings prevent complete approach walks');
});
test('SUNBOB petals and seed disc are walkable in the client and room authority',()=>{
  assert.equal(map.id,'sunflower');
  for(const nav of [client,authority]){
    const report=auditBloom(nav);
    assert.ok(report.samples>11000,'dense coverage of the actual SVG floor');
    assert.deepEqual(report.blocked,[],'only the statue base and tight furniture footprints exclude paving');
    assert.ok(report.routes.length>=8);
    assert.deepEqual(report.failed,[],'each approach crosses a petal and disc to the statue edge');
  }
  for(const b of bloomBlockers){
    assert.ok(b.rx<=102&&b.ry<=78,'only tight prop bases, never a plaza footprint');
    assert.equal(authority.walkable(b.x,b.y),false,b.name+' stays solid');
  }
});

test('SUNBOB approach walks reach the statue edge at server and render tick rates',()=>{
  for(const dt of [.05,1/60])for(const {id,points} of bloomApproaches){
    const actor={x:points[0][0],y:points[0][1],turn:0,travel:0,action:0,path:[],until:0};
    let time=0;
    for(const target of points.slice(1)){
      assert.ok(bloomFloor(...target),id+' waypoint lies on paving');
      assert.ok(setWalkDestination(actor,authority,...target),id+' starts walking');
      for(let i=0;i<Math.ceil(20/dt)&&actor.path.length;i++){
        const before=[actor.x,actor.y];
        walkStep(actor,authority,dt,time+=dt,{x:0,y:0});
        assert.ok(authority.walkable(actor.x,actor.y),id+' stays on walkable ground');
        assert.ok(authority.clearLine(before,[actor.x,actor.y]),id+' never crosses a blocker');
      }
      assert.ok(Math.hypot(actor.x-target[0],actor.y-target[1])<1,id+' reaches exact target');
    }
  }
});

test('SUNBOB stone base ellipse is within 4 px of the innermost disc centre',()=>{
  const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
  const ground=readFileSync(new URL('../public/pixi-art/themes/sunflower/bloom/plaza-bloom-ground.svg',import.meta.url),'utf8');
  const centre=read('public/pixi-art/themes/sunflower/bloom/centre-placements.json');
  const tile=centre.groundTiles.find(t=>t.src==='plaza-bloom-ground.svg');
  assert.match(ground,/<circle r="170" fill="none"/,'innermost ring shares the ground transform origin');
  const [,tx,ty]=ground.match(/transform="translate\(([\d.]+) ([\d.]+)\) scale/).map(Number);
  const disc=[tile.x+tx,tile.y+ty];
  const svg=readFileSync(new URL('../public/pixi-art/themes/sunflower/centre/clock.svg',import.meta.url),'utf8');
  assert.match(svg,/viewBox="0 0 817 1434"/);
  for(const data of [centre,read('public/pixi-art/themes/sunflower/art.json'),map.world]){
    const clock=data.props.find(p=>p.id==='centre-clock'),scale=clock.scale??1;
    const base=[clock.x+(407.5/817-clock.anchor.x)*clock.width*scale,clock.y+(1306/1434-clock.anchor.y)*clock.height*scale];
    assert.ok(Math.hypot(base[0]-disc[0],base[1]-disc[1])<=4,`stone base ${base} matches disc ${disc}`);
    assert.equal(clock.shadow,true,'contact shadow follows the base anchor');
    assert.deepEqual(clock.shadowSize,[94,42],'shadow fits the stone footprint');
    for(const p of data.props.filter(p=>p.id?.startsWith('centre-clock'))){
      assert.deepEqual([p.x,p.y],disc,'body, hands and shadow share a ground anchor for upright rendering');
    }
  }
  for(const blockers of [centre.walkBlockers,centre.centrePlacementReplacement.blocked,map.world.obstacles,map.world.centrePlacement.blocked,read('assets/world/themes/sunflower/walk-world.json').obstacles]){
    const bases=blockers.filter(b=>b.name==='clock planter');
    assert.ok(bases.length);
    for(const b of bases)assert.deepEqual([b.x,b.y],disc,'all client and authority footprints follow the stone base');
  }
});
