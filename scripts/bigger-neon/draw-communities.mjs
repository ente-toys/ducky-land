import fs from 'node:fs';
import sharp from 'sharp';
const {communities}=JSON.parse(fs.readFileSync('scripts/bigger-neon/communities.json'));
const out='../concepts/themes/world-map/bigger/';
const k=.14,tx=336,ty=322;
let b='<rect width="1764" height="1330" fill="#6ec9de"/><g transform="translate(336 322) scale(.14)"><path d="M-1850 1500Q-1800 -1650 3600 -1700Q9000 -1900 9440 1850Q9700 6400 3900 6600Q-1700 6500 -1850 1500Z" fill="#93b72f" stroke="#f9e4a1" stroke-width="210"/>';
const roads=['M-550 2320Q-1100 -750 3500 -100Q7600 -650 8310 2600Q8800 5500 3900 5750Q-1000 6400 -550 2320','M-550 2320H1450M3750 -100V1200M8310 2600H6500M3900 5750V4100'];
for(const d of roads)b+=`<path d="${d}" fill="none" stroke="#6d713c" stroke-width="390"/><path d="${d}" fill="none" stroke="#f8dea1" stroke-width="350"/>`;
b+='</g>';
const now=await sharp(out+'neon-now.png').png().toBuffer();
const inner=await sharp(now).extract({left:410,top:390,width:950,height:575}).png().toBuffer();
for(const [i,c] of communities.entries()){
 const fills=['#f4b8c7','#9fdbd5','#cab9de','#f3d49b'];
 b+=`<g transform="translate(${tx} ${ty}) scale(${k})"><ellipse cx="${c.square[0]}" cy="${c.square[1]}" rx="${c.square[2]}" ry="${c.square[3]}" fill="#f7dfaa"/>`;
 for(const [x,y]of c.homes)b+=`<g transform="translate(${x-160} ${y-310})"><path d="M0 70Q160 10 320 70V295Q160 335 0 295Z" fill="${fills[i]}" stroke="#625b76" stroke-width="12"/><path d="M-20 65L160 -10L340 65L320 100H0Z" fill="#8b83ad" stroke="#625b76" stroke-width="10"/><rect x="130" y="200" width="60" height="105" rx="15" fill="#ffeeac"/><path d="M35 150H95M225 150H285" stroke="#e5fff0" stroke-width="38"/></g>`;
 b+='</g>';
 const x=tx+c.x*k,y=ty+(c.y+660)*k;
 b+=`<g transform="translate(${x} ${y})"><rect x="-150" y="-16" width="300" height="48" rx="13" fill="#fff0d1" stroke="#625b76"/><text text-anchor="middle" font-size="18" font-family="sans-serif" fill="#51465e" y="4">${c.name}</text><text text-anchor="middle" font-size="11" font-family="sans-serif" fill="#51465e" y="22">${c.who}</text></g>`;
}
b+='<rect x="20" y="18" width="800" height="53" rx="15" fill="#fff0d1"/><text x="38" y="51" font-size="24" font-family="sans-serif" fill="#51465e">TICKYTOWN / four communities around the original clock heart</text>';
const drawing=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1764" height="1330">${b}</svg>`)).png().toBuffer();
await sharp(drawing).composite([{input:inner,left:410,top:390}]).png().toFile(out+'neon-communities.png');
console.log('Drew four named neighbourhoods before production composition.');
