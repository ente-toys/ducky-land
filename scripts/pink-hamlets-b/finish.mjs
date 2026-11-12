import {readFileSync,writeFileSync} from 'node:fs';
const files=['public/pixi-art/themes/pink/art.json','assets/world/themes/pink/world.json','assets/world/themes/pink/walk-world.json'];
for(const f of files)writeFileSync(f,JSON.stringify(JSON.parse(readFileSync(f)),null,1)+'\n');
const f='assets/world/themes/index.js';let s=readFileSync(f,'utf8');s=s.replace(/(  pink: \{[^\n]*sleepers: )(\[.*\])(\},)/,(all,a,b,c)=>{let beds=JSON.parse(b);let wing=beds.filter(p=>p.pose==='wing');for(const [p,xy]of [[wing.at(-1),[7508.96,2039.92]],[wing.at(-2),[3551.6,6485.8]]])Object.assign(p,{x:xy[0],y:xy[1],flip:false});return a+JSON.stringify(beds)+c});writeFileSync(f,s);
