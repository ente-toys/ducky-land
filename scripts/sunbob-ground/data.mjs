import {writeFileSync} from 'node:fs';
import {config,layouts,mapper} from '../bigger-sunflower/hamlets.mjs';
// Only real destination courts survive. Blueprint lane polygons caused the
// square book-sleeper patch and orphan bank strips reported by the boss.
const hamlets=Object.keys(config).flatMap(h=>{
 const square=layouts[h].square,rs=typeof square[0][0]==='number'?[square]:square;
 return rs.map(r=>r.map(mapper(h)));
});
writeFileSync('/private/tmp/sunbob-ground-data.json',JSON.stringify({hamlets}));
