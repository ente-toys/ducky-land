// Comparison sheets use equal 0.7 world zoom, without resizing the close-ups.
import sharp from 'sharp';
import {copyFileSync} from 'node:fs';
const R='../concepts/themes/work/pink/',tag=process.argv[2]??'close-round-2',base=process.argv.includes('--baseline')?'close-base-':'';
const title=t=>Buffer.from(`<svg width="1200" height="42"><rect width="100%" height="100%" fill="#FFF0C7"/><text x="18" y="28" font-size="19" font-family="sans-serif" fill="#39472D">${t}</text></svg>`);
async function sheet(names,file){
 const comps=[];
 for(const [row,name]of names.entries())for(const [col,theme]of ['home','pink'].entries()){
  const kind=theme==='home'&&!['plaza','bench','junction','trees'].includes(name)?'plaza':name;
  comps.push({input:title(`${theme.toUpperCase()} | ${name} | 0.7 world zoom | static SVG placement render`),left:col*1200,top:row*942});
  comps.push({input:await sharp(R+(theme==='pink'?base:'')+theme+'-game-'+kind+'.png').png().toBuffer(),left:col*1200,top:row*942+42});
 }
 await sharp({create:{width:2400,height:names.length*942,channels:3,background:'#FFF0C7'}}).composite(comps).png().toFile(R+file);
}
await sheet(['plaza','bench','junction','trees'],tag+'-closeups-vs-home.png');
await sheet(['cafe','festival','picnic','meadow','market','harbor','road'],tag+'-areas-vs-home.png');
copyFileSync(R+(base?'close-base-':'')+'pink-vs-home.png',R+tag+'-vs-home.png');
console.log('Saved '+tag+' equal-scale close-ups, activity areas and overview');
