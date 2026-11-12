import {mkdirSync,writeFileSync} from 'node:fs';
import {bounds,coast,communities,rivers,roads,bridges} from './plan.mjs';
import {makeAssets,dir} from './assets.mjs';
import {j,base,artDir,output,json,groundBody,plannedProps,ribbon,area,assets} from './scene.mjs';
import {inPoly} from '../../assets/world/island-geometry.mjs';
if(!j(output+'/work/snow/drawing.json'))throw Error('Draw first');
const a=j(base+'art.json'),w=j(base+'world.json'),walk=j(base+'walk-world.json');
makeAssets(true);
const bridge=assets.bridge.replace(/<svg[^>]*>/,'').replace('</svg>','');writeFileSync(dir+'bridge-h.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="470" height="320"><g transform="translate(470 0) rotate(90)">${bridge}</g></svg>`);
const tiles=[],TW=1280,TH=1300;
for(let row=0;row<8;row++)for(let col=0;col<10;col++){
 const x=bounds.x+col*TW,y=bounds.y+row*TH;
 // Omit fully covered dry-heart tiles. All original ground tiles remain intact above this layer.
 const corners=[[x,y],[x+TW,y],[x+TW,y+TH],[x,y+TH]];
 const covered=corners.every(p=>inPoly(...p,w.coast))&&!w.coast.some(([px,py])=>px>=x&&px<=x+TW&&py>=y&&py<=y+TH);
 if(covered)continue;
 const src=`communities/ground-${row}-${col}.svg`;
 writeFileSync(artDir+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}" viewBox="${x} ${y} ${TW} ${TH}">${groundBody({x,y,width:TW,height:TH})}</svg>`);
 tiles.push({src,x,y,width:TW,height:TH,resolution:.45});
}
const {props,obstacles,gardens}=plannedProps();
a.width=bounds.width;a.height=bounds.height;a.origin={x:bounds.x,y:bounds.y};a.ground.tiles=[...tiles,...a.ground.tiles];a.props.push(...props);a.flats.push(...gardens);a.decks.push(...bridges.map(b=>({id:'snow-'+b.id,name:'Snow river bridge',src:b.axis==='h'?'communities/bridge-h.svg':'communities/bridge.svg',x:b.x-b.w/2,y:b.y-b.h/2,width:b.w,height:b.h,resolution:1})));
for(const target of [w,walk]){target.width=bounds.width;target.height=bounds.height;target.origin={x:bounds.x,y:bounds.y};target.coast=coast;target.water.push(...rivers.map(r=>({name:r.name,poly:ribbon(r.line,r.width)})));target.bridges.push(...bridges.map(({id,x,y,w,h})=>({id:'snow-'+id,x,y,w:w*.77,h:h*.84})));target.obstacles.push(...obstacles);for(const r of roads){let segment=[];for(const p of r.line){if(inPoly(...p,j(base+'world.json').coast)){if(segment.length>1)target.paths.push(segment);segment=[]}else segment.push(p)}if(segment.length>1)target.paths.push(segment)}for(const c of communities)target.zones[c.id]={name:c.name,x:c.at[0],y:c.at[1],spawn:c.spawn};target.communities=communities.map(c=>({id:c.id,name:c.name,residents:c.who,homes:c.homes.length,workplaces:c.work.map(v=>v[0]),spawn:c.spawn}));target.props=a.props;}
const harbor={jetty:{foot:[4200,7150],tip:[4200,7820],width:140},spawn:j(base+'harbor.json').spawn,
boats:[{x:4350,y:7610,turn:Math.PI},{x:4050,y:7660,turn:Math.PI},{x:4350,y:7780,turn:Math.PI}]};
json('public/pixi-art/themes/snow/art.json',a);json('assets/world/themes/snow/world.json',w);json('assets/world/themes/snow/walk-world.json',walk);json('assets/world/themes/snow/harbor.json',harbor);
const bytes=art=>art.ground.tiles.reduce((s,t)=>s+t.width*t.height*(t.resolution??1)**2*4,0);
json(output+'/work/snow/build-metrics.json',{originalArea:area(j(base+'world.json').coast),newArea:area(coast),areaRatio:area(coast)/area(j(base+'world.json').coast),originalProps:j(base+'art.json').props.length,newProps:props.length,newHomes:communities.reduce((s,c)=>s+c.homes.length,0),bridges:bridges.length,newGroundTiles:tiles.length,groundTextureMiBBefore:bytes(j(base+'art.json'))/1048576,groundTextureMiBAfter:bytes(a)/1048576,maxRasterTilePixels:Math.max(...a.ground.tiles.map(t=>Math.max(t.width,t.height)*(t.resolution??1))),sharedChanges:[]});
console.log('Composed Snow: four communities, '+props.length+' new authored props, '+tiles.length+' extension ground tiles.');
