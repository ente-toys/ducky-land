import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render.mjs';
import {inPoly} from '../../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const O='../concepts/themes/world-map/bigger/',S='scripts/bigger-neon/';
const base=read(S+'baseline/art.json'),world=read(S+'baseline/world.json'),plan=read(S+'plan.json');
await render(base,O+'neon-original-recheck.png',{baseline:true,harborOverlay:false});
await render(plan.art,O+'neon-built-recheck.png',{harborOverlay:false});
const before=await sharp(O+'neon-original-recheck.png').ensureAlpha().raw().toBuffer(),after=await sharp(O+'neon-built-recheck.png').ensureAlpha().raw().toBuffer();
const dry=(x,y)=>inPoly(x,y,world.coast)||world.islets.some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1);
let compared=0,changed=0;
for(let y=0;y<1330;y++)for(let x=0;x<1764;x++){
 const wx=(x+.5-336)/.14,wy=(y+.5-322)/.14;
 // Erode the original coast by 40 world units to exclude the replaced exterior surf.
 if(![[0,0],[-40,0],[40,0],[0,-40],[0,40]].every(([dx,dy])=>dry(wx+dx,wy+dy)))continue;
 compared++;const at=(y*1764+x)*4;
 if([0,1,2,3].some(c=>before[at+c]!==after[at+c]))changed++;
}
const bytes=a=>a.ground.tiles.reduce((sum,t)=>sum+Math.ceil(t.width*(t.resolution??1))*Math.ceil(t.height*(t.resolution??1))*4,0);
const area=ps=>Math.abs(ps.reduce((s,p,i)=>{const q=ps[(i+1)%ps.length];return s+p[0]*q[1]-q[0]*p[1]},0)/2);
const report={pixelComparisonExcludes:"The interactive harbour overlay, which is explicitly refitted to the new shore",originalDryPixelsCompared:compared,changedOriginalDryPixels:changed,originalProps:base.props.length,addedProps:plan.props.length,households:plan.communities.reduce((n,c)=>n+c.homes.length,0),groundOriginalMiB:bytes(base)/1048576,groundAfterMiB:bytes(plan.art)/1048576,groundWipMiB:bytes(read(S+'wip-art.json'))/1048576,landRatio:area(plan.coast)/(area(world.coast)+world.islets.reduce((s,[,,rx,ry])=>s+Math.PI*rx*ry,0)),maxTileDimension:Math.max(...plan.art.ground.tiles.flatMap(t=>[t.width,t.height]))};
fs.writeFileSync(O+'neon-work/communities-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(report);
const header=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="3680" height="70"><rect width="100%" height="100%" fill="#fff0d1"/><g font-family="sans-serif" font-size="25" fill="#625b76"><text x="20" y="44">REFERENCE / look only</text><text x="820" y="44">NEON / worn road junction, 0.8 px per unit</text><text x="2260" y="44">NEON / residential lane, 0.8 px per unit</text></g></svg>')).png().toBuffer();
await sharp({create:{width:3680,height:1070,channels:4,background:'#fff0d1'}}).composite([{input:header,left:0,top:0},{input:'../concepts/themes/world-map/cursor-camp-paths-ref.jpg',left:0,top:270},{input:O+'neon-crops/road-junction.png',left:800,top:70},{input:O+'neon-crops/residential-lane.png',left:2240,top:70}]).png().toFile(O+'neon-paths-vs-reference.png');
if(changed)throw Error(`${changed} original dry interior pixels changed`);
