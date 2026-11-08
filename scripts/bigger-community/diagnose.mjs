import sharp from 'sharp';import fs from 'node:fs';
const A='public/pixi-art/themes/community/';
const old=await sharp(A+'ground-r0-c2.svg').resize(320,290).raw().toBuffer({resolveWithObject:true});
const ne=await sharp(A+'expansion/ground--500-2100.svg').resize(300,300).raw().toBuffer({resolveWithObject:true});
for(const [x,y]of [[3340,755],[4000,1000],[5170,765]]){const oi=(Math.round(y*.2)*320+Math.round((x-3200)*.2))*4,ni=(Math.round((y+500)*.2)*300+Math.round((x-2100)*.2))*4;console.log(x,y,[...old.data.subarray(oi,oi+4)],[...ne.data.subarray(ni,ni+4)]);}
