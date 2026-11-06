// Review-only PNG sheets live outside public. Left is Home, right is Pink, at matching world scale.
import sharp from 'sharp';
const dir='../concepts/themes/work/pink/',prefix=process.argv.includes('--close-baseline')?'close-base-':process.argv.includes('--baseline')?'before-':'';
function label(text,width){return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="42"><rect width="100%" height="100%" fill="#fff5df"/><text x="16" y="28" font-size="19" font-family="sans-serif" fill="#39472d">${text}</text></svg>`)}
const comps=[];
for(const [i,name]of ['home','pink'].entries()){
 const file=dir+(name==='pink'?prefix:'')+name+'-overview.png',m=await sharp(file).metadata();
 comps.push({input:label(`${name==='home'?'HOME':'PINK'} | SVG placement render | zoom 0.25`,2000),left:i*2000,top:0},{input:await sharp(file).png().toBuffer(),left:i*2000+Math.round((2000-m.width)/2),top:42+Math.round((1450-m.height)/2)});
}
await sharp({create:{width:4000,height:1492,channels:3,background:'#6EC9DE'}}).composite(comps).png().toFile(dir+prefix+'pink-vs-home.png');
const close=[];
for(const [row,name]of ['plaza','bench','junction','trees'].entries())for(const [col,t]of ['home','pink'].entries()){
 let im=sharp(dir+(t==='pink'?prefix:'')+t+'-'+name+'.png');if(name==='plaza')im=im.extract({left:220,top:220,width:1100,height:800});
 close.push({input:label(`${t.toUpperCase()} | ${name} | ${name==='plaza'?'0.55':'1.0'} world zoom`,1100),left:col*1100,top:row*842},{input:await im.png().toBuffer(),left:col*1100,top:row*842+42});
}
await sharp({create:{width:2200,height:3368,channels:3,background:'#fff5df'}}).composite(close).png().toFile(dir+prefix+'pink-closeups-vs-home.png');
console.log('Saved same-scale whole-island and four close-up comparisons in '+dir);
