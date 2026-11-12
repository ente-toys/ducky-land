import './proof.mjs';
import {copyFileSync,writeFileSync} from 'node:fs';
import {output,j,json} from './scene.mjs';
import {bridges,rivers,commons} from './plan.mjs';
import {inShape,inPoly} from '../../assets/world/island-geometry.mjs';
const world=j('assets/world/themes/snow/world.json'),art=j('public/pixi-art/themes/snow/art.json');
copyFileSync(output+'/snow-built.png',output+'/snow-fixed.png');
for(const [source,target]of [['aurora-bridge','bridge'],['junction','junction'],['lane','lane'],['igloo','community']])copyFileSync(output+'/ground-crops/snow/'+source+'.png',output+'/snow-fixed-'+target+'.png');
const harbor=j('assets/world/themes/snow/harbor.json');
json(output+'/work/snow/fix-audit.json',{
 authoredDecks:art.decks.length,bridges:bridges.map(b=>({id:b.id,center:[b.x,b.y],waterUnderCenter:world.water.filter(o=>inShape(b.x,b.y,o)).map(o=>o.name),transverseWaterSamples:[-.28,-.14,0,.14,.28].every(k=>world.water.some(o=>inShape(b.x+(b.axis==='v'?b.w*k:0),b.y+(b.axis==='h'?b.h*k:0),o)))})),
 runtimeJetty:{...harbor.jetty,footOnLand:inPoly(...harbor.jetty.foot,world.coast),tipInSea:!inPoly(...harbor.jetty.tip,world.coast)},
 rivers:rivers.map(r=>({name:r.name,bothMouthsInSea:[r.line[0],r.line.at(-1)].every(p=>!inPoly(...p,world.coast))})),
 commons:commons.map(c=>({name:c.name,at:c.at,props:c.props.length,beds:c.beds.length})),
 homes:art.props.filter(p=>/-home-\d\.svg$/.test(p.src)).map(p=>({id:p.id,src:p.src})),
 proof:'Static production-art assembly, including sleepers and a surrogate for the procedural jetty. No live player/camera/water animation.'
});
console.log('Saved snow-fixed overview, bridge, junction, lane and community proof plus bridge audit.');
