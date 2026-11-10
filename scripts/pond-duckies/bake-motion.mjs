import fs from 'node:fs';
import {populatePond} from './populate.mjs';
const data=JSON.parse(fs.readFileSync('src/pixi/pond-regions.json'));
data.ponds=data.ponds.map(p=>{
 const pond=populatePond(p,data.assets);
 console.log(pond.island,pond.id,pond.duckies.length+' Duckies',pond.motion.period.toFixed(0)+'s');
 return pond;
});
fs.writeFileSync('src/pixi/pond-regions.json',JSON.stringify(data)+'\n');
