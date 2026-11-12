// Resolve the boss's next twenty against the same prop, path and spacing rules as the game.
import {createServer} from 'vite';
import {readFileSync,writeFileSync} from 'node:fs';
import {geometry,inPoly,inShape} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths,sleeperFootprint} from '../../src/pixi/sleep-spots.js';
const v=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'error'});
try{
 const P=await v.ssrLoadModule('/src/pixi/placements.js'),props=P.createPlacements(),world=P.walkWorld(P.trimWorld(JSON.parse(readFileSync('assets/world/world.json'))),props),walkable=geometry(world).walkable;
 const {harborWorld}=await v.ssrLoadModule('/src/pixi/islands.js'),live=harborWorld(world);
 const beds=JSON.parse(readFileSync('qa/fixtures/home-eighty-sleepers.json')),old=JSON.parse(readFileSync('src/pixi/home-original-world.json')),routes=JSON.parse(readFileSync('src/pixi/home-routes.json'));

 const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
 const pathDist=(x,y)=>Math.min(...routes.map(r=>Math.min(...r.samples.slice(1).map((b,i)=>seg(x,y,r.samples[i],b)))-r.width/2));
 const expansion=JSON.parse(readFileSync('src/pixi/home-expansion.json'));
 const steps=(x,y)=>expansion.roads.some(r=>r.rings&&inShape(x,y,{poly:r.rings[0]}))||P.HOME_DECKS.some(p=>Math.abs(x-p.x)<p.width/2+100&&Math.abs(y-p.y)<p.height+100);
 const spots={},added=[],counts={nod:2,hammock:3,rock:3,leaf:3,book:3,chair:2,wing:2,box:2};
 const candidates=[];for(let y=-1400;y<5700;y+=110)for(let x=-2100;x<7700;x+=110)if(!inPoly(x,y,old.coast)&&walkable(x,y)&&pathDist(x,y)>100)candidates.push([x,y]);
 for(const [pose,n] of Object.entries(counts)){
  spots[pose]=[];
  const options=pose==='nod'?props.filter(p=>/tree/i.test(p.asset||p.name||'')&&!inPoly(p.x,p.y,old.coast)).map(p=>[p.id,0,false]):candidates;
  for(let i=0;i<n;i++){
   const ranked=options.map(spot=>{const tree=pose==='nod'?props.find(p=>p.id===spot[0]):null,x=tree?.x??spot[0],y=tree?tree.y+14:spot[1];return {spot,x,y,score:Math.min(...[...beds,...added].map(b=>Math.hypot(x-b.x,y-b.y)))}}).sort((a,b)=>b.score-a.score);
   let found=false;
   for(const {spot,x,y} of ranked){
    if(pathDist(x,y)<110||steps(x,y))continue;
    const s=[spot[0],spot[1],i%2===0],result=resolveSleepSpots(live,props,geometry(live).walkable,sleepHalfWidths(),{spots:{[pose]:[s]},home:true,occupied:[...beds,...added],pathDist,steps,warn:false});
    if(!result.length)continue;
    const f=sleeperFootprint(result[0]);if(routes.some(r=>r.samples.some(p=>inShape(...p,f,16))))continue;
    spots[pose].push(s);added.push(result[0]);found=true;break;
   }
   if(!found)throw Error('No valid '+pose+' '+i);
  }
 }
 writeFileSync('assets/world/home-sleep-more.json',JSON.stringify(spots,null,2)+'\n');console.log(JSON.stringify(added));
}finally{await v.close();}
