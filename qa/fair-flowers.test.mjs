import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapFor} from '../src/pixi/island-maps.js';
import {TREE_CLUMPS,FIT} from '../scripts/bigger-fair/centre-data.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const layout=read('scripts/bigger-fair/centre-source/layout.json');
const art=read('public/pixi-art/themes/fair/art.json');
test('Fair centre has open lawns, no flower fields or fence, and six small tree clumps',()=>{
 assert(!art.props.some(p=>/^ac2-flower-|^ring-fence-/.test(p.id)||p.src==='ac2/flower-box.svg'||/placed-ac2-flower-box/.test(p.src)));
 assert(!('flowerRows' in layout));
 for(const key of ['tulip-wedges','sunflower-wedges','fence-line'])assert(!(key in layout.polygons));
 for(const name of ['tulip-pink','tulip-lilac','tulip-yellow','sunflower','bunting-fence','flower-box'])
  assert(!fs.existsSync(`public/pixi-art/themes/fair/ac2/${name}.svg`));
 assert.equal(TREE_CLUMPS.length,6);
 for(const clump of TREE_CLUMPS){
  assert(clump.length>=2&&clump.length<=3);
  for(const t of clump)assert(art.props.some(p=>p.x===t.at[0]&&p.y===t.at[1]&&/^reuse\/tree-/.test(p.src)));
 }
 const nav=mapFor('fair').nav();
 for(const [x,y] of [[440,240],[1090,240],[310,365],[1230,365],[240,455],[240,625],[1285,475],[1285,625],[410,800],[1120,800],[640,550],[895,550]])
  assert(nav.walkable(FIT.cx+(x-768)*FIT.sx,FIT.cy+(y-520)*FIT.sy),`lawn ${x},${y}`);
 assert.equal(mapFor('fair').sleepers.length,90);
});
