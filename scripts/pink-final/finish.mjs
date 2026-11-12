import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
execFileSync('python3',['scripts/pink-final/finish.py'],{stdio:'inherit'});
execFileSync('python3',['scripts/pink-final/review-cleanup.py'],{stdio:'inherit'});
execFileSync('python3',['scripts/pink-final/apply-buildings.py'],{stdio:'inherit'});
const read=p=>JSON.parse(readFileSync(p)),world=read('assets/world/themes/pink/world.json'),walk=read('assets/world/themes/pink/walk-world.json'),harbor=read('assets/world/themes/pink/harbor.json'),art=read('public/pixi-art/themes/pink/art.json');
const map=makeMap('pink',{world,walk,harbor,sleepers:[]}),valid=geometry(map.walk).walkable;
const resolve=()=>resolveSleepSpots(map.walk,art.props,valid,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return [x-a[0]-t*dx,y-a[1]-t*dy];};
const roads=world.paths.flatMap(p=>p.slice(1).map((b,i)=>[p[i],b]));
const trees=art.props.filter(p=>/tree-|tree-cherry/.test(p.src));
const sizes=sleepHalfWidths(),places=read('scripts/bigger-pink/layout.json').places;
function strict(x,y,pose){
 if(places.some(p=>Math.hypot(x-p.arrival[0],y-p.arrival[1])<140))return false;
 const r=sizes[pose],rx=r*.9,ry=Math.min(34,Math.max(22,r*.42));
 if(!valid(x,y)||!valid(x-r*.8,y)||!valid(x+r*.8,y))return false;
 for(const [a,b]of roads){const [dx,dy]=seg(x,y-6,a,b),d=Math.hypot(dx,dy);if(d<89+Math.hypot(rx*dx,ry*dy)/(d||1)+14)return false;}
 for(const b of world.walkways){if(Math.hypot(...seg(x,y,b.a,b.b))<b.w/2+r+20)return false;}
 for(const t of trees)if(((x-t.x)/(r+65))**2+((y-t.y)/(r*.65+40))**2<1)return false;
 return true;
}
const adjustments=[];
for(let pass=0;pass<8;pass++){
 let changed=0;
 for(const [pose,spots]of Object.entries(world.sleepSpots))for(const spot of spots){
  const tree=pose==='nod'?art.props.find(p=>p.id===spot[0]):null;
  const xy=()=>tree?[tree.x+(spot[1]??0),tree.y+14]:spot.slice(0,2);
  const resolves=()=>{const [x,y]=xy();return strict(x,y,pose)&&resolve().some(s=>s.pose===pose&&s.x===x&&s.y===y);};
  if(resolves())continue;
  const before=[...spot];let found=false;
  if(tree){
   for(let d=140;d<=650&&!found;d+=20)for(const sign of [1,-1]){spot[1]=sign*d;if(resolves()){found=true;break;}}
  }else{
   for(let r=30;r<=1500&&!found;r+=30)for(let a=0;a<48&&!found;a++){
    spot[0]=Math.round(before[0]+r*Math.cos(a*Math.PI/24));spot[1]=Math.round(before[1]+r*Math.sin(a*Math.PI/24));if(resolves())found=true;
   }
  }
  if(!found)throw Error('No clear '+pose+' bed near '+JSON.stringify(before));
  adjustments.push({pose,from:before,to:[...spot]});changed++;
 }
 if(!changed)break;
}
const beds=resolve();if(beds.length!==40||beds.bad.length||beds.some(b=>!strict(b.x,b.y,b.pose)))throw Error('Sleeper overlap remains '+JSON.stringify(beds.bad));
writeFileSync('assets/world/themes/pink/world.json',JSON.stringify(world,null,1)+'\n');
const file='assets/world/themes/index.js';let src=readFileSync(file,'utf8');const line=src.split('\n').find(l=>l.startsWith('  pink:'));
const sleepers=beds.map(({x,y,pose,r,flip,tree})=>({x:Math.round(x),y:Math.round(y),pose,r:Math.round(r*10)/10,flip,...(tree?{tree}:{})}));
writeFileSync(file,src.replace(line,line.replace(/sleepers: \[.*\]/,'sleepers: '+JSON.stringify(sleepers))));
writeFileSync('scripts/pink-final/sleeper-adjustments.json',JSON.stringify(adjustments,null,1)+'\n');
console.log('40 approved sleepers resolved; five hamlets assembled.');
