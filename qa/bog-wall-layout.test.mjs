import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BOG_BLOCKERS} from '../src/features/bog-combat/bog-blockers.js';
import {DUCK_RADIUS} from '../src/features/bog-combat/physics.js';
import {inPoly} from '../assets/world/island-geometry.mjs';
import {groupFeet,shelters} from './bog-wall-layout-helpers.mjs';
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/bog-arena/art.json'));
const layout=JSON.parse(fs.readFileSync('scripts/bog-environment/layout.json'));
const map=JSON.parse(fs.readFileSync('src/features/bog-combat/bog-environment.json'));
const groups=layout.wallLayout.groups;
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const touches=(a,b)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;
const distance=(x,y,[ax,ay],[bx,by])=>{const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-ax-t*dx,y-ay-t*dy);};

test('all revised cover belongs to a connected lane or court structure, with real wall returns',()=>{
 const ids=groups.flatMap(g=>g.members);assert.equal(new Set(ids).size,ids.length);
 assert.equal(ids.length,131,'83 original pieces plus 48 field walls');
 assert.equal(groups.filter(g=>g.shape==='U').length,2);
 for(const g of groups){
  const feet=groupFeet(g);assert.equal(feet.length,g.members.length,g.id);
  assert.ok(feet.length>=2,g.id+' is a structure rather than a lone block');
  const reached=new Set([feet[0]]);let previous;
  do{previous=reached.size;for(const b of feet)if([...reached].some(q=>touches(b,q)))reached.add(b);}while(previous!==reached.size);
  assert.equal(reached.size,feet.length,g.id+' all pieces join');
  assert.ok(feet.some(b=>b.width>b.height)&&feet.some(b=>b.height>b.width),g.id+' physical wall return');
  const route=layout.routes.find(r=>r.id===g.route);
  if(route){const b=feet[0],x=b.x+b.width/2,y=b.y+b.height/2;
   assert.ok(Math.min(...route.points.slice(1).map((p,i)=>distance(x,y,route.points[i],p)))<=335,g.id+' belongs to its lane');
   for(let i=1;i<route.points.length;i++){
    const a=route.points[i-1],b=route.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8);
    for(let j=0;j<=n;j++){const x=a[0]+(b[0]-a[0])*j/n,y=a[1]+(b[1]-a[1])*j/n;
     for(const foot of feet){const dx=Math.max(foot.x-x,0,x-foot.x-foot.width),dy=Math.max(foot.y-y,0,y-foot.y-foot.height);
      assert.ok(Math.hypot(dx,dy)>=DUCK_RADIUS*2,g.id+' leaves two-Ducky route floor');
     }
    }
   }
  }
 }
 for(const p of art.props.filter(p=>p.author==='warzone'&&p.coverFootprints))assert.ok(ids.includes(p.id),p.id+' has no orphan placement');
});

test('supply plinths join walls, broken corners share footprints and U bunkers have broad open mouths',()=>{
 for(const g of groups){const ps=art.props.filter(p=>g.members.includes(p.id)),feet=groupFeet(g);
  for(const p of ps.filter(p=>/^wz-(sacks|crates|barrels)$/.test(p.name))){const b=feet.find(b=>b.prop===p.id||b.id===p.id);
   assert.ok(feet.some(q=>q!==b&&touches(b,q)&&/^wz-(wall|ruin)/.test(art.props.find(p=>p.id===(q.prop??q.id)).name)),p.id+' touches a wall');
  }
  const broken=ps.filter(p=>p.name.startsWith('wz-ruin'));if(broken.length)assert.ok(broken.length>=2,g.id+' broken structure has two segments');
  if(g.shape==='U'){
   const returns=feet.filter(b=>b.height>b.width).sort((a,b)=>a.x-b.x);
   assert.equal(returns.length,2,g.id);
   assert.ok(returns[1].x-returns[0].x-returns[0].width>=DUCK_RADIUS*4,g.id+' broad open mouth');
   assert.ok(shelters(g).length>=2,g.id+' two accessible exterior sides');
  }
 }
});

test('cover sits on dry ground and does not intersect unrelated walls, trees or buildings',()=>{
 for(const g of groups)for(const b of groupFeet(g)){
  for(const q of BOG_BLOCKERS.filter(q=>!g.members.includes(q.prop??q.id)))assert.equal(overlaps(b,q),false,b.id+' intersects '+q.id);
  for(const x of [b.x,b.x+b.width/2,b.x+b.width])for(const y of [b.y,b.y+b.height/2,b.y+b.height]){
   assert.ok(inPoly(x,y,map.world.coast),b.id+' inside coast');
   assert.ok(!map.world.water.some(w=>inPoly(x,y,w.poly)),b.id+' outside pond');
  }
 }
});
