// Hand-authored resting pockets, separated from the B2 walking corridors.
import {readFileSync,writeFileSync} from 'node:fs';
import {geometry} from '../../rive/web/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const file='rive/web/themes/snow/world.json',w=JSON.parse(readFileSync(file)),a=JSON.parse(readFileSync('public/pixi-art/themes/snow/art.json'));
const spots=Object.fromEntries(['nod','hammock','rock','leaf','book','chair','wing','box'].map(n=>[n,[]]));
const trees=a.props.filter(p=>p.id.includes('-tree-'));
// Tree-backed residents are chosen individually, with spacing checked below.
for(const id of ['grove-0-tree-0','grove-2-tree-1','grove-3-tree-2','grove-4-tree-0','grove-5-tree-0','grove-6-tree-2','grove-7-tree-1','grove-8-tree-1','grove-9-tree-0','grove-10-tree-2','grove-11-tree-1','grove-12-tree-1','grove-13-tree-0','grove-14-tree-1','grove-15-tree-0','grove-16-tree-1','grove-17-tree-1','grove-18-tree-1','grove-19-tree-0','grove-20-tree-1','grove-0-tree-3','grove-1-tree-3','grove-2-tree-4','grove-3-tree-0','grove-8-tree-4','grove-10-tree-0','grove-10-tree-4','grove-12-tree-0','grove-15-tree-4','grove-18-tree-0']){
 const trial={...spots,nod:[...spots.nod,[id,0,false]]};const r=resolveSleepSpots(w,a.props,geometry(w).walkable,sleepHalfWidths(),{spots:trial,avoid:w.sleepAvoid,warn:false});if(!r.bad.length)spots.nod.push([id,0,false]);
}
// Named open-snow pockets traced around groves, hamlets and the south clearing.
const pockets=[[570,150],[650,210],[446,224],[360,210],[224,192],[149,352],[265,392],[325,454],[373,494],[204,558],[139,660],[199,644],[379,663],[412,709],[352,768],[199,782],[89,771],[205,849],[319,848],[362,956],[517,1002],[579,1021],[678,1000],[704,929],[683,813],[605,800],[533,876],[548,937],[907,947],[909,881],[980,721],[937,647],[1081,523],[1140,562],[1168,650],[1219,665],[1275,600],[1324,557],[1352,478],[1333,366],[1267,338],[1177,334],[1110,333],[1050,365],[994,321],[901,363],[908,412],[858,305],[715,395],[712,457],[580,420],[558,351],[478,475],[359,585],[258,673],[845,179],[995,166],[1071,191],[1162,192],[739,192],[705,254],[671,390],[526,241],[443,300],[815,864],[883,747],[1054,749],[1161,867],[1214,768],[806,990],[584,592],[621,621],[729,681],[762,745],[919,533],[886,449],[1029,625],[1174,475],[279,531],[89,825],[292,965],[663,972],[133,708],[560,190],[1007,236],[741,848],[422,843],[500,918],[561,106],[666,150],[464,220],[570,450],[643,382],[553,539],[359,356],[119,383],[231,473],[117,747],[364,720],[350,889],[586,885],[549,974],[694,1044],[796,932],[870,900],[1166,725],[1188,569],[1274,468],[1360,350],[1099,408],[1023,564],[901,248],[1013,117],[1187,279],[753,139],[424,1005],[480,1000],[899,820]];
const scale=w.iceland2.traceScale; // use exact scale recovered from first traced anchor
const poses=['hammock','rock','leaf','book','chair','wing','box'];
for(const [i,p] of pockets.entries()){
 if(Object.values(spots).flat().length>=60)break;
 for(let k=0;k<poses.length;k++){
  const pose=poses[(i+k)%poses.length],bed=[Math.round(600+p[0]*scale),Math.round(600+p[1]*scale),i%2===0];
  const trial={...spots,[pose]:[...spots[pose],bed]};const r=resolveSleepSpots(w,a.props,geometry(w).walkable,sleepHalfWidths(),{spots:trial,avoid:w.sleepAvoid,warn:false});
  if(!r.bad.length){spots[pose].push(bed);break;}
 }
}
w.sleepSpots=spots;
console.log('Authored residents',Object.fromEntries(Object.entries(spots).map(([k,v])=>[k,v.length])),Object.values(spots).flat().length);
for(const p of [file,'rive/web/themes/snow/walk-world.json'])writeFileSync(p,JSON.stringify(w,null,1)+'\n');
