import fs from 'node:fs';const F='src/pixi/home-expansion.json',E=JSON.parse(fs.readFileSync(F));const w=E.riverWater.find(w=>w.id==='mill-sea-outlet'),old=JSON.stringify(w.poly);
const p=[[6200,1800],[6660,1750],[7080,1660],[7340,1500],[7420,1250],[7800,1200],[8250,1200],[8250,2600],[7800,2600],[7560,2400],[7470,2130],[7340,1950],[7100,1880],[6650,1930],[6200,1980]],out=[];
for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length],d=p[(i+2)%p.length],n=Math.max(4,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/30));for(let j=0;j<n;j++){const t=j/n,u=1-t;out.push([0,1].map(k=>u**3*b[k]+3*u*u*t*(b[k]+(c[k]-a[k])/6)+3*u*t*t*(c[k]-(d[k]-b[k])/6)+t**3*c[k]));}}
w.poly=out;E.boatWater=E.boatWater.map(poly=>JSON.stringify(poly)===old?out:poly);fs.writeFileSync(F,JSON.stringify(E,null,2)+'\n');

const inlet=E.riverWater.find(w=>w.id==='quay-tidal-inlet'),previous=JSON.stringify(inlet.poly);
const bank=[[3200,5780],[3350,5720],[3440,5600],[3550,5500],[3800,5490],[4300,5490],[4650,5500],[4820,5570],[4940,5660],[5150,5700],[5350,5700],[5350,6400],[3200,6400]],curve=[];
for(let i=0;i<bank.length;i++){const a=bank[(i+bank.length-1)%bank.length],b=bank[i],c=bank[(i+1)%bank.length],d=bank[(i+2)%bank.length],n=Math.max(4,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/25));for(let j=0;j<n;j++){const t=j/n,u=1-t;curve.push([0,1].map(k=>u**3*b[k]+3*u*u*t*(b[k]+(c[k]-a[k])/6)+3*u*t*t*(c[k]-(d[k]-b[k])/6)+t**3*c[k]));}}
inlet.poly=curve;E.boatWater=E.boatWater.map(poly=>JSON.stringify(poly)===previous?curve:poly);E.reviewProps['grow-tree-2']={x:300,y:2150};fs.writeFileSync(F,JSON.stringify(E,null,2)+'\n');
