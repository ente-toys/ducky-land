import {readFileSync,writeFileSync} from 'node:fs';
const file='assets/world/themes/index.js',report=JSON.parse(readFileSync('scripts/pink-hamlets/report.json'));
let src=readFileSync(file,'utf8');
const line=src.split('\n').find(l=>l.startsWith('  pink:'));
const beds=JSON.parse(line.match(/sleepers: (\[.*\])/)[1]);
for(const s of report.sleepers){const bed=beds.filter(b=>b.pose===s.pose)[s.slot];Object.assign(bed,{x:s.point[0],y:s.point[1],flip:false});}
src=src.replace(line,line.replace(/sleepers: \[.*\]/,'sleepers: '+JSON.stringify(beds)));
writeFileSync(file,src);
