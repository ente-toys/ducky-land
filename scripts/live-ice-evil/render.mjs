import sharp from 'sharp';
import {readFileSync,mkdirSync} from 'node:fs';
const out='../concepts/themes/codex-builds/live-add-ice-evil';mkdirSync(out,{recursive:true});
for(const theme of ['bog','snow']) {
  const base=`public/pixi-art/themes/${theme}/`,a=JSON.parse(readFileSync(base+'art.json')),k=.2,layers=[];
  async function add(p,standing=false) {
    const s=p.scale??1,w=p.width*s,h=p.height*s,anchor=standing?(p.anchor??{x:.5,y:1}):p.topLeft===false?{x:.5,y:1}:{x:0,y:0};
    const left=Math.round((p.x-w*anchor.x)*k),top=Math.round((p.y-h*anchor.y)*k);
    const src=p.src.startsWith('/')?'public'+p.src:base+p.src;
    let image=sharp(src).resize(Math.round(w*k),Math.round(h*k),{fit:'fill'});if(p.flip)image=image.flop();
    const buf=await image.png().toBuffer();
    if(left>=0&&top>=0&&left+Math.round(w*k)<=1600&&top+Math.round(h*k)<=1200)layers.push({input:buf,left,top});
  }
  for(const p of a.ground.tiles)await add(p);
  for(const p of a.flats)await add(p,!p.topLeft);
  for(const p of a.decks)await add(p);
  for(const p of [...a.props].sort((a,b)=>a.y-b.y))await add(p,true);
  await sharp({create:{width:1600,height:1200,channels:4,background:a.sea}}).composite(layers).png().toFile(`${out}/${theme}-overview.png`);
}
