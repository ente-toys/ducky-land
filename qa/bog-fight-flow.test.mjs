import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BOG_COMBAT} from '../src/features/bog-combat/config.js';
import {DUCK_RADIUS,traceShot} from '../src/features/bog-combat/physics.js';

import {groupFeet,shelters,hasWideBypass,shortCrossing} from './bog-wall-layout-helpers.mjs';
const layout=JSON.parse(fs.readFileSync('scripts/bog-environment/layout.json'));
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/bog-arena/art.json'));
const cover=art.props.filter(p=>p.id.startsWith('lane-cover-'));
const groups=layout.wallLayout.groups.filter(g=>g.id.startsWith('lane-cover-'));

test('lane cover stops paint with reachable shelter on both sides of each connected structure',()=>{
 assert.equal(groups.length,16);
 for(const g of groups){
  for(const b of groupFeet(g))assert.equal(traceShot(...shortCrossing(b),BOG_COMBAT.blockers).blocker?.id,b.id,b.id+' catches paint');
  const points=shelters(g);assert.ok(points.length>=2,g.id+' shelter');
  assert.ok(BOG_COMBAT.navigation.route(...points[0],...points[1]).length,g.id+' flank');
 }
});

test('every lane structure leaves a continuous two-Ducky-wide bypass around all its arms',()=>{
 for(const g of groups)assert.ok(hasWideBypass(g),g.id+' two-Ducky bypass');
});

test('foreground kit foliage leaves each lane cover fully visible',()=>{
 const bounds=p=>({left:p.x-p.width*p.anchor.x,right:p.x+p.width*(1-p.anchor.x),
  top:p.y-p.height*p.anchor.y,bottom:p.y+p.height*(1-p.anchor.y)});
 for(const p of cover){
  const a=bounds(p);
  for(const q of art.props.filter(q=>/^(tree|bush)-/.test(q.name)&&q.y>=p.y)){
   const b=bounds(q),overlaps=b.left<a.right&&b.right>a.left&&b.top<a.bottom&&b.bottom>a.top;
   assert.equal(overlaps,false,`${q.id} cannot hide ${p.id}`);
  }
 }
});
