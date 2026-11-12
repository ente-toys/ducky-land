import {read,smooth} from './design.mjs';
const old=read('scripts/bigger-fair/original-world.json');
const expand=(xk,yk)=>old.coast.map(([x,y])=>[+(3600+(x-3600)*xk).toFixed(1),+(2300+(y-2300)*yk).toFixed(1)]);
export const inner=expand(1.012,1.018),outer=expand(1.065,1.105);
export function ribbon(line,width){const left=[],right=[];line.forEach(([x,y],i)=>{const a=line[Math.max(0,i-1)],b=line[Math.min(line.length-1,i+1)],len=Math.hypot(b[0]-a[0],b[1]-a[1])||1;const w=width/2*(1+.12*Math.sin(i*.41));left.push([x-(b[1]-a[1])/len*w,y+(b[0]-a[0])/len*w]);right.push([x+(b[1]-a[1])/len*w,y-(b[0]-a[0])/len*w]);});return [...left,...right.toReversed()];}
export const streams=[
 {id:'ribbon-run',name:'Ribbon Run',line:smooth([[560,3200],[-300,3350],[-800,3500],[-1300,3370],[-1800,3320],[-2200,3420]],false,8),width:145},
 {id:'wishwater',name:'Wishwater Brook',line:smooth([[6910,1980],[7340,1840],[7820,1930],[8240,1810],[8680,1620],[9230,1730]],false,8),width:155}
].map(s=>({...s,poly:ribbon(s.line,s.width)}));
export const water=[...inner.map((a,i)=>({id:'heart-canal-'+i,poly:[a,inner[(i+1)%inner.length],outer[(i+1)%outer.length],outer[i]]})),...streams.map(s=>({id:s.id,poly:s.poly})),{id:'wish-orchard-pond',x:950,y:-310,rx:300,ry:130}];
export const pathD=pts=>'M'+pts.map(q=>q.map(v=>Math.round(v*10)/10).join(' ')).join('L')+'Z';
export const crossings=[
 {id:'west-heart',x:370,y:2830,w:420,h:180,horizontal:true},
 {id:'northwest-heart',x:520,y:780,w:290,h:400},
 {id:'north-heart',x:3560,y:370,w:300,h:390},
 {id:'northeast-heart',x:6560,y:665,w:280,h:340},
 {id:'east-heart',x:6900,y:2590,w:440,h:200,horizontal:true},
 {id:'southeast-heart',x:6460,y:3730,w:300,h:400},
 {id:'south-heart',x:3570,y:4070,w:300,h:410},
 {id:'southwest-heart',x:820,y:3780,w:300,h:480},
 {id:'ribbon-coast',x:-1550,y:3340,w:260,h:420},
 {id:'wishwater-lane',x:7780,y:1930,w:280,h:440},
 {id:'wishwater-coast',x:8500,y:1700,w:290,h:440}
];
export const oldDeckBridges=old.walkways.map((b,i)=>({id:'restored-deck-'+i,x:(b.a[0]+b.b[0])/2,y:(b.a[1]+b.b[1])/2,w:Math.abs(b.a[0]-b.b[0])+b.w,h:Math.abs(b.a[1]-b.b[1])+b.w}));
