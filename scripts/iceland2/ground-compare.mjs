// Equal 1600 x 1000 world-unit crops, rendered at one output pixel per world unit.
import {homeLayers} from '../globe-perf/snapshot.mjs';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
const out=process.argv[2];if(!out)throw Error('Output directory required');
const layersHome=homeLayers();const home=[...layersHome.tiles,...layersHome.flats.filter(p=>/decals\/(grass|pebble)/.test(p.src)).map(p=>({...p,x:p.x-p.width/2,y:p.y-p.height}))];
const nest=p=>{const s=readFileSync('public'+p.src,'utf8');const root=s.slice(0,s.indexOf('>')+1).replace(/\s(?:width|height|x|y)="[^"]*"/g,'').replace('<svg',`<svg x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}"`);return root+s.slice(s.indexOf('>')+1);};
const terrain=readFileSync('public/pixi-art/themes/snow/v2/terrain.svg','utf8');
const world=JSON.parse(readFileSync('assets/world/themes/snow/world.json'));const z=world.zones.plaza;
const crops=[{title:'ICELAND FIX3',x:z.x-800,y:z.y-700,body:terrain.slice(terrain.indexOf('>')+1,terrain.lastIndexOf('</svg>'))},{title:'HOME',x:1300,y:2700,body:home.map(nest).join('')}];
const layers=[];for(let i=0;i<crops.length;i++){let c=crops[i];const s=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="540"><rect width="800" height="540" fill="#f3eee5"/><text x="22" y="28" font-family="sans-serif" font-size="18" fill="#39472d">${c.title} · identical 1600 × 1000 world-unit crop</text><svg y="40" width="800" height="500" viewBox="${c.x} ${c.y} 1600 1000">${c.body}</svg></svg>`;layers.push({input:await sharp(Buffer.from(s)).png().toBuffer(),left:i*800,top:0});}
await sharp({create:{width:1600,height:540,channels:4,background:'#f3eee5'}}).composite(layers).png().toFile(out+'/side.png');
