import fs from 'node:fs';
import sharp from 'sharp';
import {render,read,OUT} from './render.mjs';
const art=read('public/pixi-art/themes/canal/art.json');
await render(art,OUT+'/canal-fixed.png',{cx:4000,cy:3000,k:.105,W:1500,H:1200});
for(const [name,cx,cy] of [
 ['bridge',-800,575],['road-junction',9200,2820],['lane',3350,-500],
 ['community',-650,1650],['petalpost',4000,-650],['pearlbutton',8850,2200],
 ['reedwhistle',1900,6300],['orchard',1050,-820],['picnic',6860,6550],
 ['original-centre-conflict',4000,3320]
])await render(art,OUT+`/canal-fixed-${name}.png`,{cx,cy,k:.8,W:1500,H:1100});
const ref=await sharp(OUT+'/../cursor-camp-paths-ref.jpg').resize(1500,1100,{fit:'contain',background:art.sea}).png().toBuffer();
await sharp({create:{width:3000,height:2200,channels:3,background:art.sea}}).composite([
 {input:ref,left:0,top:0},{input:OUT+'/canal-fixed-road-junction.png',left:1500,top:0},
 {input:ref,left:0,top:1100},{input:OUT+'/canal-fixed-lane.png',left:1500,top:1100}
]).png().toFile(OUT+'/canal-fixed-paths-vs-reference.png');
fs.writeFileSync('scripts/bigger-canal/fix-proof.json',JSON.stringify({
 renderer:'Static production SVG assembly; no live players, GPU water animation or runtime contact shadows',
 overview:'canal-fixed.png',crops:{pixelsPerWorldUnit:.8,width:1500,height:1100},
 originalPreservation:read('scripts/bigger-canal/pixel-validation.json').preservation,
 bridgeAudit:read('scripts/bigger-canal/bridge-audit.json')
},null,2)+'\n');
