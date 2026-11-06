import sharp from 'sharp';
const A='public/pixi-art/';
const items=[['detail/buildings--library.svg',520],['detail/street--lamp-lantern.svg',300],['plants/tree-1.svg',300],['detail/street--bench-wood.svg',180],['detail/street--planter-flowers.svg',160],['plants/bush-2.svg',150],['detail/buildings--stall-bread.svg',300]];
const W=1600,H=700; let x=30; const comps=[];
for(const [f,h] of items){const buf=await sharp(A+f,{density:300}).resize({height:h}).png().toBuffer();const m=await sharp(buf).metadata();comps.push({input:buf,left:x,top:H-40-m.height});x+=m.width+30;}
await sharp({create:{width:Math.max(W,x),height:H,channels:4,background:'#ffffff'}}).composite(comps).png().toFile(process.argv[2]);
