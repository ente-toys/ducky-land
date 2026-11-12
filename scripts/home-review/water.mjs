import {readFileSync,writeFileSync} from 'node:fs';
const F='src/pixi/home-expansion.json',E=JSON.parse(readFileSync(F));
const lines=[{id:'lily-outflow',points:[[1640,2820],[1650,3050],[1640,3420]],width:160},{id:'race-mill-link',points:[[4610,1650],[4900,1670],[5240,1650]],width:170},{id:'mill-sea-outlet',points:[[6190,1890],[6660,1840],[7120,1780],[7840,1780]],width:180}];
const sample=p=>{const out=[];for(let i=0;i<p.length-1;i++){const a=p[i-1]??p[i],b=p[i],c=p[i+1],d=p[i+2]??c,n=Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/24);for(let j=0;j<n;j++){const t=j/n,u=1-t;out.push([0,1].map(k=>u**3*b[k]+3*u*u*t*(b[k]+(c[k]-a[k])/6)+3*u*t*t*(c[k]-(d[k]-b[k])/6)+t**3*c[k]));}}out.push(p.at(-1));return out;};
for(const l of lines){const p=sample(l.points),L=[],R=[];for(let i=0;i<p.length;i++){const a=p[Math.max(0,i-1)],b=p[Math.min(p.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy);L.push([p[i][0]-dy/n*l.width/2,p[i][1]+dx/n*l.width/2]);R.push([p[i][0]+dy/n*l.width/2,p[i][1]-dx/n*l.width/2]);}const w={id:l.id,x:l.points[1][0],y:l.points[1][1],rx:1,ry:1,poly:[...L,...R.reverse()]};E.riverWater=E.riverWater.filter(w=>w.id!==l.id).concat(w);E.rivers=E.rivers.filter(r=>r.id!==l.id).concat(l);}
const W=JSON.parse(readFileSync('assets/world/world.json'));const pond=W.water.find(w=>Math.abs(w.x-1640)<2);
const ellipse=w=>Array.from({length:80},(_,i)=>[w.x+Math.cos(i*Math.PI/40)*w.rx,w.y+Math.sin(i*Math.PI/40)*w.ry]);
const lake=JSON.parse(readFileSync('src/pixi/walk-shapes.json')).lake;
E.boatWater=[...E.riverWater.map(w=>w.poly),E.water.poly,pond.poly??ellipse(pond),lake];
E.riverMouths=[[2930,5450,3195,6080],[3250,5400,5050,6250],[7300,1650,8060,1920]];
E.reviewWater=true;
if(E.arches.length===7)E.arches.push({a:[1520,2930],b:[1780,2930],w:112,r:24});
E.arches[6].a=[4930,1650];
E.walkways=E.walkways.filter(w=>!w.reviewWater).concat([{a:[1520,2930],b:[1780,2930],w:112,boatPassUnder:true,reviewWater:true}]);
const link=E.walkways.find(w=>Math.abs(w.a[0]-5150)<1&&Math.abs(w.a[1]-1650)<1);if(link)link.a=[4930,1650];
if(!E.riverBridges.some(b=>b.id==='lily-outflow-bridge'))E.riverBridges.push({id:'lily-outflow-bridge',x:1650,y:2930,w:280,h:100});
writeFileSync(F,JSON.stringify(E,null,2)+'\n');
