import {mkdirSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
import {bounds,bridges} from './plan.mjs';
import {makeAssets,dir,specs} from './assets.mjs';
import {j,base,output,artDir,groundBody,plannedProps,renderArt,json,assets} from './scene.mjs';
mkdirSync(base,{recursive:true});mkdirSync(output+'/work/snow',{recursive:true});
for(const [name,path]of [['art','public/pixi-art/themes/snow/art.json'],['world','rive/web/themes/snow/world.json'],['walk-world','rive/web/themes/snow/walk-world.json'],['harbor','rive/web/themes/snow/harbor.json']])if(!existsSync(base+name+'.json'))copyFileSync(path,base+name+'.json');
const old=j(base+'art.json');
writeFileSync(output+'/snow-now.png',await renderArt(old));
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}">${groundBody()}</svg>`;
writeFileSync('scripts/bigger-snow/plan-ground.svg',svg);
const {props,gardens}=plannedProps();
// Draw directly with the planned native assets before changing any production manifest.
const drawing={...old,ground:{tiles:[{src:'../../../../scripts/bigger-snow/plan-ground.svg',...bounds,x:bounds.x,y:bounds.y},...old.ground.tiles]},props:[...old.props,...props],flats:[...old.flats,...gardens],decks:bridges.map(b=>({src:b.axis==='h'?'communities/bridge-h.svg':'communities/bridge.svg',x:b.x-b.w/2,y:b.y-b.h/2,width:b.w,height:b.h}))};
const bridge=assets.bridge.replace(/<svg[^>]*>/,'').replace('</svg>','');assets['bridge-h']=`<svg xmlns="http://www.w3.org/2000/svg" width="470" height="320"><g transform="translate(470 0) rotate(90)">${bridge}</g></svg>`;
writeFileSync(output+'/snow-communities.png',await renderArt(drawing,{labels:true}));
json(output+'/work/snow/drawing.json',{created:new Date().toISOString(),source:'scripts/bigger-snow/plan.mjs',note:'Drawing completed before compose. Native SVG concept using the same authored kit as production; original heart overlaid unchanged.',bounds});
console.log('Drew Snow community plan before production changes.');
