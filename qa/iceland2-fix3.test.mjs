import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tileInView,tileResolution,GROUND_BUDGET_BYTES} from '../src/pixi/ground-stream.js';
const a=JSON.parse(readFileSync('public/pixi-art/themes/snow/art.json'));
const w=JSON.parse(readFileSync('assets/world/themes/snow/world.json'));
const terrain=readFileSync('public/pixi-art/themes/snow/v2/terrain.svg','utf8');
test('FIX3 snow detail is terrain-only and every zone has sharp ground coverage',()=>{
 assert.ok(terrain.includes('snow-grain'));assert.ok(!terrain.includes('<pattern'));
 for(const z of Object.values(w.zones))assert.ok(a.ground.tiles.some(t=>z.x>=t.x&&z.x<t.x+t.width&&z.y>=t.y&&z.y<t.y+t.height));
 assert.ok(!a.props.some(p=>/snow-pile|snow-fence|snow-crates/.test(p.id)));
});
test('FIX3 every hamlet has a door court and occupational scene',()=>{
 assert.equal((terrain.match(/data-door-court=/g)??[]).length,w.iceland2.doors.length);
 for(const [id] of w.iceland2.doors){const yard=a.props.filter(p=>p.building===id);for(const role of ['woodpile','lamp','bench'])assert.ok(yard.some(p=>p.finalRole===role),id+' '+role);}
 for(const role of ['sled','snowman','cocoa-cart','bench-skates'])assert.ok(a.props.some(p=>p.finalRole===role),role);

});
test('FIX3 stepped sled hill stays free of plant bases and lake has a bench with skates',()=>{
 const h=a.flats.find(p=>p.id==='sled-hill');
 const text=readFileSync('public/pixi-art/themes/snow/'+h.src,'utf8');assert.ok(text.includes('<svg'));assert.ok(h.width>=640&&h.width<=720&&h.height>=340&&h.height<=400);
 for(const p of a.props.filter(p=>/grove|bush/.test(p.id)))assert.ok(!(p.x>h.x-h.width/2-70&&p.x<h.x+h.width/2+70&&p.y>h.y-h.height-80&&p.y<h.y+100));
 assert.equal(a.props.filter(p=>p.scene==='rink-scene'&&p.finalRole==='bench-skates').length,1);
});
test('FIX3 static SVG path avoids raster worker and sharp close-view demand fits the shared pool',()=>{
 assert.equal(a.raster.enabled,false);
 const all=[...a.ground.tiles,...a.props.flatMap(p=>p.tiles.map(t=>({...t,x:p.x-p.width/2+t.x,y:p.y-p.height+t.y}))),...a.flats.flatMap(p=>p.tiles.map(t=>({...t,x:p.x-(p.topLeft?0:p.width/2)+t.x,y:p.y-(p.topLeft?0:p.height)+t.y})))];
 for(const [name,z] of Object.entries(w.zones))for(const [width,height] of [[1440,900],[390,844]]){
  const camera={x:z.x,y:z.y,zoom:1.8};const visible=all.filter(t=>tileInView(t,camera,width,height));
  let bytes=0;for(const t of visible){const r=tileResolution(t,1.8,2);assert.ok(r>=3.6,name+' soft tile');bytes+=Math.ceil(t.width*r)*Math.ceil(t.height*r)*4;}
  assert.ok(bytes<GROUND_BUDGET_BYTES*.9,name+' exceeds close-view texture budget: '+bytes);
 }
});
