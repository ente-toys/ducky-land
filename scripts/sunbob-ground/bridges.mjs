import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const F='public/pixi-art/themes/sunflower/art.json',E=JSON.parse(readFileSync(F));
const W=JSON.parse(readFileSync('rive/web/themes/sunflower/world.json')); const arches=W.arches;
const bridges=arches.map((r,i)=>({...r,id:r.id??'retained-'+i,w:r.w,src:i===0?'bridge-nw.svg':i===1?'bridge-se.svg':'bigger/arch-'+r.id+'.svg'}));
const S={ns:[[120,312],[120,53]],ew:[[32,168],[448,168]],ne:[[90,296],[395,104]],nw:[[395,296],[85,104]]};

for(const r of bridges){
 const [a,b]=r.a[1]>=r.b[1]?[r.a,r.b]:[r.b,r.a],v=[b[0]-a[0],b[1]-a[1]],dir=Math.abs(v[1])<Math.abs(v[0])*.25?'ew':Math.abs(v[0])<Math.abs(v[1])*.25?'ns':v[0]>0?'ne':'nw';
 let s=readFileSync('public/pixi-art/home-expansion-c/bridges/bridge-'+dir+'.svg','utf8');
 const [W,H]=s.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1).map(Number);let [n,f]=S[dir];if(dir==='ew'&&v[0]<0)[n,f]=[f,n];
 // Map longitudinal axis to the required span; keep the transverse plank width at source scale.
 const u=[f[0]-n[0],f[1]-n[1]],cross=dir==='ew'?[0,1]:dir==='ns'?[1,0]:[1,dir==='ne'?.62:-.62];
 const depth=.62,gv=[v[0],v[1]/depth],sg=Math.sign(cross[0]*u[1]-cross[1]*u[0])||1;
 let q=[gv[1],-gv[0]*depth],ql=Math.hypot(q[0],q[1]/depth),cl=Math.hypot(cross[0],cross[1]/depth);q=q.map(x=>x*cl/ql);
 if((q[0]*v[1]-q[1]*v[0])*sg<0)q=q.map(x=>-x);
 const det=u[0]*cross[1]-u[1]*cross[0];
 const A=(v[0]*cross[1]-q[0]*u[1])/det,C=(q[0]*u[0]-v[0]*cross[0])/det,B=(v[1]*cross[1]-q[1]*u[1])/det,D=(q[1]*u[0]-v[1]*cross[0])/det;
 const X=a[0]-A*n[0]-C*n[1],Y=a[1]-B*n[0]-D*n[1];
 let inner=s.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 // Keep the approved structure, remove only the raised sand end-sill slabs.
 const start=inner.indexOf('<g stroke=');const head=inner.slice(0,start),body=inner.slice(start);
 const pos=body.indexOf('<!-- '+(dir==='ew'?'Far handrail':dir==='ns'?'The arch':'Back rail'));
 if(pos>0){const gend=body.indexOf('>')+1;inner=head+body.slice(0,gend)+body.slice(pos);}
 const corners=[[0,0],[W,0],[0,H],[W,H]].map(([x,y])=>[A*x+C*y+X,B*x+D*y+Y]),xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
 const box=[Math.min(...xs)-2,Math.min(...ys)-2,Math.max(...xs)-Math.min(...xs)+4,Math.max(...ys)-Math.min(...ys)+4],fmt=n=>+n.toFixed(4);
 const src='/pixi-art/themes/sunflower/'+r.src;
 writeFileSync('public'+src,`<svg data-home-source="/pixi-art/home-expansion-c/bridges/bridge-${dir}.svg" xmlns="http://www.w3.org/2000/svg" width="${box[2]}" height="${box[3]}" viewBox="${box.join(' ')}"><g transform="matrix(${[A,B,C,D,X,Y].map(fmt).join(' ')})">${inner}</g></svg>`);
 const deck=E.decks.find(d=>d.src===r.src);Object.assign(deck,{homeSource:'/pixi-art/home-expansion-c/bridges/bridge-'+dir+'.svg',bridgeId:r.id,a:r.a,b:r.b,x:box[0],y:box[1],width:box[2],height:box[3],resolution:1.5,overBoats:true}); arches[bridges.indexOf(r)].r=+Math.abs(D*24).toFixed(3); arches[bridges.indexOf(r)].squash=dir==='ew'?.62:undefined;
}
// The same deck axes and crowns serve both client and room walking data.
const rects=[];
for(const r of arches){
 const dx=r.b[0]-r.a[0],dy=r.b[1]-r.a[1],len=Math.hypot(dx,dy),half=(r.w/2-10)/(Math.abs(dx/len)+Math.abs(dy/len));
 for(let t=0;t<=len;t+=12)rects.push({name:r.id??'retained-'+arches.indexOf(r),x:r.a[0]+dx*t/len,y:r.a[1]+dy*t/len,w:half*2+16,h:half*2+24});
}
W.bridges=rects;
W.walkways=arches.map((r,i)=>({id:r.id??'retained-'+i,a:r.a,b:r.b,w:r.w,boatPassUnder:true}));
const walk=JSON.parse(readFileSync('rive/web/themes/sunflower/walk-world.json'));
Object.assign(walk,{bridges:rects,walkways:W.walkways,arches});
writeFileSync('rive/web/themes/sunflower/walk-world.json',JSON.stringify(walk,null,1)+'\n');
const sizes=JSON.parse(readFileSync('src/pixi/art-source-sizes.json'));
for(const d of E.decks)if(d.homeSource)sizes['/pixi-art/themes/sunflower/'+d.src]=[d.width,d.height];
writeFileSync('src/pixi/art-source-sizes.json',JSON.stringify(sizes)+'\n');
writeFileSync(F,JSON.stringify(E,null,1)+'\n');
writeFileSync('rive/web/themes/sunflower/world.json',JSON.stringify(W,null,1)+'\n');
console.log('All',bridges.length,'crossings reuse Home art, without end sills.');
