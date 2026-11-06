// Compare the supplied HOME photograph and the whole library at equal world scale.
// The reference coast spans 4720 world units / about 1227 screen pixels: zoom .26.
// Input library renders use .3. Both panels here use .185 pixels per world unit.
import sharp from 'sharp';
import {copyFileSync} from 'node:fs';
const ROOT='../concepts/themes/work/library/';
const input=process.argv[2]||ROOT+'library-preview.png',round=process.argv[3];
const width=1600,height=1100,zoom=.185;
async function panel(file,factor){
 const {width:w,height:h}=await sharp(file).metadata();
 const scaled=await sharp(file).resize(Math.round(w*factor),Math.round(h*factor)).png().toBuffer();
 const m=await sharp(scaled).metadata();
 return sharp({create:{width,height,channels:4,background:'#6EC9DE'}}).composite([{input:scaled,left:Math.round((width-m.width)/2),top:Math.round((height-m.height)/2)}]).png().toBuffer();
}
const left=await panel('../concepts/themes/home-bigger-before-island.png',zoom/.26);
const right=await panel(input,zoom/.3);
const header=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width*2+24}" height="90"><rect width="100%" height="100%" fill="#fff5d5"/><g font-family="Arial,sans-serif" fill="#39472D"><text x="30" y="36" font-size="27" font-weight="bold">HOME / supplied reference</text><text x="1654" y="36" font-size="27" font-weight="bold">PAGEPOND / library ${round?'round '+round:''}</text><text x="30" y="68" font-size="18">Equal world scale, approx. 0.185 px per unit. HOME source calibration: 0.26.</text><text x="1654" y="68" font-size="18">Whole island asset render. 40 sleepers. All activity and stall interiors remain open.</text></g></svg>`);
const out=ROOT+'library-vs-home.png';
await sharp({create:{width:width*2+24,height:height+90,channels:4,background:'#fff5d5'}}).composite([{input:await sharp(header).png().toBuffer(),left:0,top:0},{input:left,left:0,top:90},{input:right,left:width+24,top:90}]).png().toFile(out);
if(round)copyFileSync(out,ROOT+`library-vs-home-round-${round}.png`);
console.log(out);
