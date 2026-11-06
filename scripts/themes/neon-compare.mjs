// Compare the actual theme render with the supplied HOME screenshot.
import sharp from 'sharp';
import fs from 'node:fs';
const A='../concepts/themes/work/neon/';
const home='../concepts/themes/home-bigger-before-island.png';
const round=process.env.ROUND||'final';
const panelW=2100,panelH=1400,labelH=54;
const label=(title)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${panelW}" height="${labelH}"><rect width="100%" height="100%" fill="#fff0c7"/><text x="24" y="35" font-family="sans-serif" font-size="22" fill="#3d422c">${title}</text></svg>`);
// HOME calibration from coast span: about .26 px/world unit. Neon renders at K=.26.
// Preserve HOME's supplied 1600 x 1100 pixels and center both full islands, with no fit scaling.
async function panel(file){const m=await sharp(file).metadata();return sharp({create:{width:panelW,height:panelH,channels:4,background:'#6EC9DE'}}).composite([{input:await sharp(file).toBuffer(),left:Math.round((panelW-m.width)/2),top:Math.round((panelH-m.height)/2)}]).png().toBuffer();}
const left=await panel(home),right=await panel(A+'neon-preview.png');
await sharp({create:{width:panelW*2,height:panelH+labelH,channels:4,background:'#6EC9DE'}}).composite([{input:label('HOME | supplied reference'),left:0,top:0},{input:label(`NEON | round ${round} | 0.26 px/world unit, 40 sleepers`),left:panelW,top:0},{input:left,left:0,top:labelH},{input:right,left:panelW,top:labelH}]).png().toFile(A+'neon-vs-home.png');
fs.copyFileSync(A+'neon-vs-home.png',A+`neon-vs-home-round-${round}.png`);
console.log(A+'neon-vs-home.png');
