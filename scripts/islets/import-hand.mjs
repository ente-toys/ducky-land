#!/usr/bin/env node
// boss 8 Nov ("the perspective of the islets is bad", "wtf is that docking port"): the 11 sea islets are hand-drawn SVG now,
// each with its jetty drawn in the art. This copies them from the artists' folder into the game unchanged, and writes each
// one's <art>.meta.json beside it in one shape: the jetty foot and tip, the walkable land, its holes and its blocked
// footprints, all in the 1024 viewBox. No art is generated or traced here.
// Usage: node scripts/islets/import-hand.mjs [artists' folder]
import {readFileSync,writeFileSync} from 'node:fs';
import {applyDepth} from './apply-depth.mjs';
const ART=['odyssey','tree-and-rowboat','broken-shipwreck','04-small-mountain','05-lighthouse-rock','06-palm-treasure','07-pink-blossom','08-snow-igloo','09-spooky-purple','11-volcano','12-coral-atoll'];
const FROM=process.argv[2]||'../concepts/themes/work/islets-hand',TO='public/pixi-art/islets';
// The width each was drawn for, so all eleven meet the Home centre's line weight (about 2 world units) and duck scale: the
// first three ink at 1.4 for an islet 1600 wide, 04-09 at 2 with a viewBox unit a world unit, 11 and 12 at 2.22.
const DESIGN_WIDTH={};   // the GPT redraw (8 Nov 20:05) inks every islet at the kit weight in its 1024 viewBox
// Footprints the artists left out (their note: "ducks would walk through them"), read off the drawings on a 50-unit grid.
const ADD_BLOCKED={};   // the GPT redraw's own meta.json carries its footprints
const NAME={'11-volcano':'volcano cone','12-coral-atoll':'giant clam'};
// the artists wrote footprints four ways: {name: polygon}, [{what, polygon}], one bare polygon, or a list of polygons
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
