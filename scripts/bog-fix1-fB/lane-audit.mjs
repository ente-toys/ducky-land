import fs from 'node:fs';
const layout=JSON.parse(fs.readFileSync('scripts/bog-environment/layout.json'));
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/bog-arena/art.json'));
function smooth(p){
 const q=[p[0],...p,p.at(-1)],out=[];
 for(let i=1;i<q.length-2;i++){
  const [a,b,c,d]=q.slice(i-1,i+3);
  for(let j=0;j<16;j++){const t=j/16;out.push([0,1].map(k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)));}
 }
 return [...out,p.at(-1)];
}
function dist(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
const roads=layout.routes.map(r=>({...r,line:smooth(r.points)})),issues=[];
for(const p of [...art.props,...art.flats].filter(p=>p.id?.startsWith('fb-')&&!p.id.includes('moon-seal'))){
 let edge=Infinity,road;
 for(const r of roads)for(let i=1;i<r.line.length;i++){
  const d=dist([p.x,p.y],r.line[i-1],r.line[i])-r.width/2;
  if(d<edge){edge=d;road=r.id;}
 }
 const minimum=p.name?.startsWith('tree-')?54:p.width/2+12;
 if(edge<minimum)issues.push({id:p.id,road,edge:Math.round(edge*10)/10,minimum});
}
console.log(JSON.stringify({issues},null,2));
if(issues.length)process.exitCode=1;
