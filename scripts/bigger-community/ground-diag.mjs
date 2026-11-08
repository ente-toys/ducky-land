import fs from 'node:fs';import sharp from 'sharp';
const s=fs.readFileSync('public/pixi-art/themes/community/ground-r0-c2.svg','utf8');
const ns=s.replace('width="1600" height="1450" viewBox="3200 0 1600 1450"','width="1500" height="1500" viewBox="2100 -500 1500 1500"');fs.writeFileSync('/private/tmp/com-ground-diag.svg',ns);
const b=await sharp(Buffer.from(ns)).resize(300,300).ensureAlpha().raw().toBuffer();const i=(251*300+248)*4;console.log('original body in new viewport',[...b.subarray(i,i+4)]);
