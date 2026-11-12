// Fair waterways expose the SAME live sea plane as Home. No independent water
// painter, mouth fan, texture phase, or tint can form a seam at either outlet.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PALETTE} from '../../src/pixi/palette.js';
const base='public/pixi-art/themes/fair/';
export function applyFairWater({land:currentLand}={}){
 const art=JSON.parse(fs.readFileSync(base+'art.json'));
 art.sea='#'+PALETTE.water.toString(16).toUpperCase().padStart(6,'0');
 const land=currentLand??JSON.parse(fs.readFileSync('scripts/bigger-fair/path-routes.json')).land;
 const world=JSON.parse(fs.readFileSync('assets/world/themes/fair/world.json'));
 const dry=execFileSync('python3',['scripts/bigger-fair/water-banks.py'],{input:JSON.stringify({land,mouths:world.riverMouths}),encoding:'utf8'}).trim();
 for(const tile of art.ground.tiles){
  const file=base+tile.src,svg=fs.readFileSync(file,'utf8');
  let next=svg.replace(/<g data-name="Fair water union">[\s\S]*?<\/g>/g,'');
  // Retained islet decorations and shoreline shading must stop at the real
  // dry bank too, rather than cover any part of the navigable lagoon/sea.
  if(next.includes('id="fair-dry-banks"'))next=next.replace(/(<clipPath id="fair-dry-banks"><path d=")[^"]+/,`$1${dry}`);
  else next=next.replace(/(<svg\b[^>]*>)/,`$1<defs><clipPath id="fair-dry-banks"><path d="${dry}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#fair-dry-banks)">`).replace(/<\/svg>\s*$/,'</g></svg>');
  if(next!==svg)fs.writeFileSync(file,next);
 }
 fs.writeFileSync(base+'art.json',JSON.stringify(art,null,1)+'\n');
}
if(process.argv[1]?.endsWith('/water.mjs'))applyFairWater();
