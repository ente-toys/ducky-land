import fs from 'node:fs';
import {inShape,inPoly} from '../../assets/world/island-geometry.mjs';
export const crossings=[
 {id:'jetty-1.svg',name:'Original west jetty',samples:[[340,2850],[430,2850],[510,2850]]},
 {id:'jetty-2.svg',name:'Original east jetty',samples:[[7290,2850],[7370,2850],[7470,2850]]},
 {id:'jetty-3.svg',name:'Original south jetty',samples:[[3900,4840],[3900,4920],[3900,5010]]},
 {id:'bridge-west.svg',name:'Original west islet bridge',samples:[[1750,4430],[1680,4500]]},
 {id:'bridge-east.svg',name:'Original east islet bridge',samples:[[6030,4420],[6100,4500]]},
 {id:'stepping-stones.svg',name:'Original lagoon stepping stones',samples:[[5000,2330],[5000,2440],[5000,2550]]},
 {id:'waterfall-river-bridge-1.svg',name:'Original spring bridge',samples:[[5190,1960],[5210,1980]]},
 {id:'waterfall-river-bridge-2.svg',name:'Original upper river bridge',samples:[[6600,1600],[6590,1647]]},
 {id:'community/arched-stream-bridge.svg@-970',name:'Mistmill north bridge',samples:[[2310,-835],[2330,-825]]},
 {id:'community/arched-stream-bridge.svg@1505',name:'Reedwater north bridge',samples:[[9230,1640],[9220,1680]]},
 {id:'community/arched-stream-bridge.svg@6560',name:'Fishers inlet footbridge',samples:[[4250,6695],[4300,6700]]},
 {id:'community/arched-stream-bridge.svg@490',name:'Mistmill south bridge',samples:[[2190,625],[2190,655]]},
 {id:'community/canal-deck-end.svg@west',name:'West canal extension',samples:[[277.5,2850]],beforeCentre:[235,2850]},
 {id:'community/canal-deck-end.svg@east',name:'East canal extension',samples:[[7522.5,2850]],beforeCentre:[7580,2850]},
 {id:'community/arched-reed-crossing.svg',name:'Reedwater lower bridge',samples:[[9570,2500],[9570,2520]]},
 {id:'community/old-north-canal-pier.svg',name:'North canal pier',samples:[[2200,850],[2200,1000],[2200,1100]]},
 {id:'runtime-harbor',name:'Interactive sea harbour',samples:[[4820,7650],[4820,7800]],sea:true}
];
export const isWet=(w,p,sea=false)=>w.water.some(q=>inShape(...p,q))||(sea&&!inPoly(...p,w.coast));
if(process.argv[1]?.endsWith('/review-audit.mjs')){
 const current=JSON.parse(fs.readFileSync('assets/world/themes/waterfall/world.json'));
 const baselineFile='scripts/bigger-waterfall/review-baseline.json';
 let baseline;
 if(fs.existsSync(baselineFile))baseline=JSON.parse(fs.readFileSync(baselineFile));
 else{
  const before=JSON.parse(fs.readFileSync('/private/tmp/waterfall-review-before-world.json'));
  baseline=crossings.map(c=>({id:c.id,beforeWet:c.samples.filter(p=>isWet(before,p,c.sea)).length,...(c.beforeCentre?{beforeCentreWet:isWet(before,c.beforeCentre)}:{})}));
  fs.writeFileSync(baselineFile,JSON.stringify(baseline,null,2));
 }
 const entries=crossings.map(c=>({...c,...baseline.find(b=>b.id===c.id),afterWet:c.samples.filter(p=>isWet(current,p,c.sea)).length}));
 fs.writeFileSync('../concepts/themes/world-map/bigger/waterfall-fix-proof/bridge-audit.json',JSON.stringify(entries,null,2));
 console.log(entries.map(c=>`${c.name}: before ${c.beforeWet}/${c.samples.length}, after ${c.afterWet}/${c.samples.length}`).join('\n'));
 if(entries.some(e=>e.afterWet!==e.samples.length))process.exitCode=1;
}
