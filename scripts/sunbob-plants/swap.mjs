import {readFileSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read = f => JSON.parse(readFileSync(f));
const sizes = {'tree-1':[260,360],'tree-2':[180,360],'tree-3':[300,380],'tree-4':[200,280],'tree-5':[150,380],'bush-1':[130,100],'bush-2':[168,110],'bush-3':[116,104],'bush-4':[140,100]};
const plant = p => /(?:^|[-/])(?:tree|bush|shrub)(?=[-/.]|$)/i.test(p.src ?? '');
function swap(p) {
  if (!plant(p)) return p;
  const file = p.src.split('/').at(-1).replace('.svg','');
  const kind = /tree/i.test(file) ? 'tree' : 'bush';
  const approved = sizes[file] ? file : file === 'bush-5' ? 'bush-2' : file === 'bush-6' ? 'bush-3' : Object.keys(sizes).filter(k => k.startsWith(kind)).sort((a,b) => Math.abs(Math.log((sizes[a][0]/sizes[a][1])/(p.width/p.height))) - Math.abs(Math.log((sizes[b][0]/sizes[b][1])/(p.width/p.height))))[0];
  return {...p, src:`/pixi-art/plants/${approved}.svg`};
}
for (const file of ['public/pixi-art/themes/sunflower/art.json','assets/world/themes/sunflower/world.json','assets/world/themes/sunflower/walk-world.json']) {
  const doc = read(file), before = structuredClone(doc);
  if (!doc.props) continue;
  doc.props = doc.props.map(swap);
  let changed = 0;
  for (const [i,p] of doc.props.entries()) {
    const old = before.props[i];
    assert.deepEqual({...p,src:old.src},old);
    if (plant(p)) {assert.match(p.src,/^\/pixi-art\/plants\/(tree-[1-5]|bush-[1-4])\.svg$/);assert.ok(readFileSync('public'+p.src).length);}
    if(p.src !== old.src) changed++;
  }
  assert.deepEqual({...doc,props:before.props},before);
  if(changed) writeFileSync(file,JSON.stringify(doc,null,1)+'\n');
  console.log(file,{plants:doc.props.filter(plant).length,changed});
}
