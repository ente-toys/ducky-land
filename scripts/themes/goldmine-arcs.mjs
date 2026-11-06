// Home's exact slatted arc recipe, fitted to Goldmine's own plaza and lawn rims.
import {writeFileSync} from 'node:fs';
import {drawArcBench} from '../arc-bench-draw.mjs';
const A='public/pixi-art/themes/goldmine/';
const rings=[{id:'plaza',x:4100,y:2910,r:861,k:360/470,angles:[22,70,110,160]}, {id:'west-lawn',x:1930,y:1900,r:610,k:390/560,angles:[-100,160,38]}, {id:'east-lawn',x:6020,y:2180,r:630,k:420/580,angles:[-110,15,140]}, {id:'south-lawn',x:4050,y:4230,r:700,k:330/650,angles:[-142,-38,52]}];
const records=[];
for(const ring of rings)for(const deg of [...ring.angles,...Array.from({length:36},(_,i)=>i*10-180)]){
 const span=ring.id==='plaza'&&deg===110?12:18;
 const b={deg,span},ground=(a,r)=>[ring.x+Math.cos(a*Math.PI/180)*r,ring.y+Math.sin(a*Math.PI/180)*r*ring.k];
 const o={ground,sIn:ring.r-20,sOut:ring.r+20,back:ring.r+24,seat:17,top:47,ink:'#39472D',line:2.2,thin:1.5};
 const points=(r)=>Array.from({length:25},(_,i)=>ground(deg-span/2+i*span/24,r));
 const poly=[...points(o.sIn-4),...points(o.back+4).reverse()];
 const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);const x=Math.floor(Math.min(...xs))-5,y=Math.floor(Math.min(...ys))-54,w=Math.ceil(Math.max(...xs))-x+5,h=Math.ceil(Math.max(...ys))-y+6;
 const [ax,ay]=ground(deg,ring.r),name=`arc-${ring.id}-${deg}.svg`;
 writeFileSync(A+'detail/'+name,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}"><g stroke-linecap="round" stroke-linejoin="round">${drawArcBench(b,o).join('')}</g></svg>`);
 records.push({id:'gold-'+name.replace('.svg',''),name:'Curved timber bench',src:'detail/'+name,x:ax,y:ay,width:w,height:h,scale:1,anchor:{x:(ax-x)/w,y:(ay-y)/h},shadow:false,footprint:{poly}});
}
writeFileSync(A+'arc-benches.json',JSON.stringify(records,null,2));
