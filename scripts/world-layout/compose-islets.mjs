// Authored coordinates, never a random scatter. Keep identities, size and artwork.
import fs from 'node:fs';
const file='src/pixi/islets-data.json',data=JSON.parse(fs.readFileSync(file)),composition=JSON.parse(fs.readFileSync('scripts/world-layout/islet-composition.json'));
for(const row of data.placements){const p=composition[row.art];if(!p)throw Error('Missing authored placement: '+row.art);row.lon=p.lon*Math.PI/180;row.lat=p.lat*Math.PI/180;}
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
