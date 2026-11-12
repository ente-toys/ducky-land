#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {applyDepth} from './apply-depth.mjs';
const ART=['odyssey','tree-and-rowboat','broken-shipwreck','04-small-mountain','05-lighthouse-rock','06-palm-treasure','07-pink-blossom','08-snow-igloo','09-spooky-purple','11-volcano','12-coral-atoll'];
const FROM=process.argv[2]||'../concepts/themes/work/islets-hand',TO='public/pixi-art/islets';
const DESIGN_WIDTH={};
const ADD_BLOCKED={};
const NAME={'11-volcano':'volcano cone','12-coral-atoll':'giant clam'};
function footprints(b,art){
 if(!b)return [];
 if(!Array.isArray(b))return Object.entries(b).map(([what,polygon])=>({what,polygon}));
 if(b.every(e=>!Array.isArray(e)))return b.map(({what,polygon})=>({what,polygon}));
 if(b.every(e=>typeof e[0]==='number'))return [{what:NAME[art],polygon:b}];
 return b.map(polygon=>({what:NAME[art],polygon}));
}
for(const art of ART){
 const m=JSON.parse(readFileSync(`${FROM}/${art}.meta.json`,'utf8'));
 const out={art,viewBox:[0,0,1024,1024],designWidth:m.designedWorldWidth??DESIGN_WIDTH[art]??1024,
  jetty:{foot:m.jetty.foot,tip:m.jetty.tip,width:m.jetty.width},
  land:m.land??m.walkable,holes:m.holes??[],blocked:[...footprints(m.blocked,art),...(ADD_BLOCKED[art]??[])],
  ...(m.steps?{steps:m.steps}:{}),note:m.note??m.notes??m.walkableNote};
 const layered=applyDepth(readFileSync(`${FROM}/${art}.svg`,'utf8'),out);
 writeFileSync(`${TO}/${art}.meta.json`,JSON.stringify(layered.meta)+'\n');
 writeFileSync(`${TO}/${art}.svg`,layered.svg);
 console.log(art,out.designWidth,'blocked:',out.blocked.map(b=>b.what).join(', ')||'none');
}
