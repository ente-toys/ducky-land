import test from 'node:test';
import assert from 'node:assert/strict';
import {furnitureDepth} from '../src/rendering/pixi/furniture-depth.js';

test('furniture depth keeps the plain depth while an island\'s props have not loaded (live black screen 17 Nov)', () => {
  for (const props of [undefined, null, []]) assert.equal(furnitureDepth(props, 100, 200, 250), 250);
  assert.equal(furnitureDepth(undefined, 100, 200), 200);
});

test('furniture depth skips footprints without a point list instead of crashing every frame (live freeze on Rosybutton 17 Nov)', () => {
  const props=[
    {src:'a.svg',name:'bench',x:0,y:0,width:100,height:60,footprint:{x:0,y:0,rx:40,ry:20}},
    {src:'b.svg',name:'stall',x:0,y:0,width:100,height:60,footprint:{parts:[{poly:[[0,0],[10,0],[10,10]]}]}},
    {src:'c.svg',name:'lamp',x:0,y:0,width:20,height:80,footprint:{poly:undefined,parts:[undefined]}},
  ];
  assert.doesNotThrow(()=>furnitureDepth(props,5,5,7));
  assert.equal(typeof furnitureDepth(props,5,5,7),'number');
});

test('houses keep rear/front depth while neighbourhood furniture still draws in front',()=>{
  const prop=name=>({src:name+'.svg',name,x:0,y:100,z:100,width:100,height:100,
    footprint:{prop:name,poly:[[-50,0],[50,0],[50,100],[-50,100]],propBase:true}});
  const house=prop('clovercrust-cottage');
  assert.equal(furnitureDepth([house],0,25),25,'the roof covers a duck behind the house');
  assert.equal(furnitureDepth([house],0,125),125,'a duck in front stays in front');
  for(const name of ['bakery-bread-rack','cafe-workbench','birdhouse'])
    assert.ok(furnitureDepth([prop(name)],0,25)>100,`${name} retains the furniture rule`);
});

test('Rosybutton arrival indexes both real art and outlined footprints without freezing',async()=>{
  const {mapOf}=await import('../src/world/island-maps.js');
  const {readFile}=await import('node:fs/promises');
  const manifest=JSON.parse(await readFile(new URL('../public/pixi-art/themes/pink/art.json',import.meta.url),'utf8'));
  assert.ok(manifest.props.some(p=>p.footprint&&!p.footprint.poly),'real pre-outline ellipse footprints are present');
  for(const props of [manifest.props,mapOf('sunset').world.props]){
    assert.ok(props.some(p=>p.y>5300),'southern hamlets are covered');
    for(const p of props)assert.ok(Number.isFinite(furnitureDepth(props,p.x,p.y)),`${p.id}: finite depth`);
  }
  assert.equal(furnitureDepth(undefined,4000,5300),5300,'arrival before art is safe');
});
