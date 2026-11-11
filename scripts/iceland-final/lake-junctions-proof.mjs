import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const base='public/pixi-art/themes/snow',art=JSON.parse(fs.readFileSync(path.join(base,'art.json')));
const out=process.argv[2]??'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/iceland-final/check/lake-junctions.png';
const terrain=fs.readFileSync(path.join(base,art.ground.vector),'utf8');
const part=p=>{
 const ax=p.topLeft?0:p.anchor?.x??.5,ay=p.topLeft?0:p.anchor?.y??1;
 return `<g transform="translate(${p.x-p.width*ax} ${p.y-p.height*ay})">${fs.readFileSync(path.join(base,p.src),'utf8').replace('<svg','<svg x="0" y="0"').replace(/width="[^"]+" height="[^"]+"/,`width="${p.width}" height="${p.height}"`)}</g>`;
};
const panels=[];
for(const [i,l] of art.icelandFinal.lake.junctions.entries()){
 const [cx,cy]=l.center,x=cx-310,y=cy-260,width=620,height=520;
 const include=p=>{
  const ax=p.topLeft?0:p.anchor?.x??.5,ay=p.topLeft?0:p.anchor?.y??1;
  return p.x+p.width*(1-ax)>x&&p.x-p.width*ax<x+width&&p.y+p.height*(1-ay)>y&&p.y-p.height*ay<y+height;
 };
 for(let row=0;row<2;row++){
  const flats=art.flats.filter(p=>include(p)&&(row===0||p.id==='rink')).map(part).join('');
  const props=row===0?art.props.filter(p=>include(p)&&p.finalKind!=='smoke').sort((a,b)=>(a.z??a.y)-(b.z??b.y)).map(part).join(''):'';
  const scene=`<svg xmlns="http://www.w3.org/2000/svg" width="620" height="560"><rect width="620" height="560" fill="#fbf8ff"/><text x="20" y="28" font-family="Arial" font-size="20" fill="#39472d">${l.id} ${row?'ground and shore':'placed art'}</text><svg x="0" y="40" width="620" height="520" viewBox="${x} ${y} ${width} ${height}">${terrain}${flats}${props}</svg></svg>`;
  panels.push({input:await sharp(Buffer.from(scene)).png().toBuffer(),left:i*620,top:row*560});
 }
}
fs.mkdirSync(path.dirname(out),{recursive:true});
await sharp({create:{width:1860,height:1120,channels:4,background:'#fbf8ff'}}).composite(panels).png().toFile(out);
console.log(out);
