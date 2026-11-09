import sharp from 'sharp';import {readFileSync,writeFileSync} from 'node:fs';
const E=JSON.parse(readFileSync('src/pixi/home-expansion.json')),props=E.props.filter(p=>p.communityRole==='home'||p.communityRole==='workplace');
const list=props.filter(p=>!/vegetable|bed|rack|cart|flowers|kiln/.test(p.src));const cells=[];const W=1200,cw=240,ch=260;
for(let i=0;i<list.length;i++){const p=list[i],b=await sharp('public'+p.src).resize(215,215,{fit:'inside'}).png().toBuffer(),m=await sharp(b).metadata();cells.push({input:b,left:i%5*cw+10,top:Math.floor(i/5)*ch});cells.push({input:Buffer.from(`<svg width="240" height="40"><text x="5" y="14" font-size="10">${p.id.replace('hamlet-','')}</text></svg>`),left:i%5*cw,top:Math.floor(i/5)*ch+218});}
await sharp({create:{width:W,height:Math.ceil(list.length/5)*ch,channels:4,background:'#c4d282'}}).composite(cells).png().toFile('/tmp/home-buildings-before.png');
writeFileSync('scripts/home-review/building-audit.json',JSON.stringify(list.map(p=>({id:p.id,src:p.src,width:p.width,height:p.height})),null,2));
