// Keep accepted proposals; move only residents rejected by the new path corridor.
import{readFileSync,writeFileSync}from'node:fs';
import{resolveSleepSpots,sleepHalfWidths}from'../../src/pixi/sleep-spots.js';
import{geometry}from'../../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(readFileSync(p)),W=read('rive/web/themes/sunflower/world.json'),walk=read('rive/web/themes/sunflower/walk-world.json'),art=read('public/pixi-art/themes/sunflower/art.json');
const spots=Object.fromEntries(Object.keys(W.sleepSpots).map(k=>[k,[]])),sizes=sleepHalfWidths(),dry=geometry(walk).walkable,occupied=[],moves=[];
const opts={avoid:W.sleepAvoid,warn:false};
function trySpot(pose,s){const b=resolveSleepSpots(walk,art.props,dry,sizes,{...opts,spots:{[pose]:[s]},occupied});if(!b.length)return false;spots[pose].push(s);occupied.push(b[0]);return true;}
const rejected=[];
for(const[pose,list]of Object.entries(W.sleepSpots))for(const s of list)if(!trySpot(pose,s))rejected.push({pose,s});
for(const{pose,s}of rejected){let found=false;
 if(typeof s[0]==='string')throw Error('nod lost '+s);
 for(let r=80;r<=2000&&!found;r+=40)for(let j=0;j<48&&!found;j++){
  const q=[Math.round(s[0]+Math.cos(j*Math.PI/24)*r),Math.round(s[1]+Math.sin(j*Math.PI/24)*r),s[2]];
  if(trySpot(pose,q)){moves.push({pose,from:s,to:q});found=true;}
 }
 if(!found)throw Error('No clearing for '+pose+' '+s);
}
W.sleepSpots=spots;
const final=resolveSleepSpots(walk,art.props,dry,sizes,{...opts,spots});
if(final.length!==90||final.bad.length)throw Error('residents '+final.length);
writeFileSync('rive/web/themes/sunflower/world.json',JSON.stringify(W,null,1)+'\n');
writeFileSync('scripts/sunbob-ground/resident-report.json',JSON.stringify({total:final.length,moves},null,2)+'\n');console.log('Residents',final.length,'moved from conflicts',moves.length);
