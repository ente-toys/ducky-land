// Offline Home reference from the SAME placement functions used by PixiIsland.
// The only transform replaces Vite's asset URL glob with its local filesystem map.
import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
const result=await build({stdin:{contents:`export * from './src/pixi/placements.js';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'local-assets',setup(b){b.onLoad({filter:/placements\.js$/},async a=>{let s=readFileSync(a.path,'utf8');const lib=JSON.parse(readFileSync('assets/manifest.json'));const urls=Object.fromEntries(lib.assets.map(a=>['../../'+a.file,'/'+a.file]));s=s.replace(/import\.meta\.glob\([^;]+\)/,JSON.stringify(urls));return{contents:s,loader:'js'}})}}]});
const P=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const {geometry}=await import('../../rive/web/island-geometry.mjs');
const world=P.trimWorld(JSON.parse(readFileSync('rive/web/world.json'))), original=JSON.parse(readFileSync('src/pixi/art-manifest.json'));
const props=P.createPlacements(world,geometry(world).walkable);
const flats=[{src:'/pixi-art/lake-race.svg',x:3400,y:1050,width:1500,height:950,topLeft:true},{src:'/pixi-art/decals/plaza-paving.svg',x:2330,y:1980,width:980,height:780,topLeft:true},...P.decalsFor(world,props,geometry({...world,obstacles:[]}).walkable)];
const art={width:world.width,height:world.height,sea:'#8CC8CD',ground:original.ground,decks:[...P.JETTIES,{src:'/pixi-art/library-steps.svg',x:2780,y:1370,width:280,height:260}],props,flats,floating:original.floating};
writeFileSync('public/pixi-art/themes/neon/neon-home-reference.json',JSON.stringify(art));
console.log({homeProps:props.length,homeTrees:props.filter(p=>/tree/i.test(p.asset||p.name)).length,homeFlats:flats.length});
