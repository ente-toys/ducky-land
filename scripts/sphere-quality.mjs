// Independent CPU reference for the actual atlas lookup and lighting. Comparing
// colours catches see-through land even though the final framebuffer alpha is 1.
import {WORLD_ISLANDS,WORLD_GEO} from '../src/pixi/world-map.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {dot,logMap} from '../src/pixi/sphere.js';
import {spherePixel,horizonRatio} from '../src/pixi/sphere-projection.js';
import {paintWeight} from '../src/pixi/globe-screen.js';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
const median=a=>a.sort((a,b)=>a-b)[a.length>>1]??null;
const quantile=(a,t)=>a.sort((a,b)=>a-b)[Math.floor((a.length-1)*t)]??null;
const light=[-.5,.5,.72],ln=Math.hypot(...light);
function bilinear(image,u,v){
 const x=u*image.width-.5,y=v*image.height-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
 const at=(x,y)=>{x=Math.max(0,Math.min(image.width-1,x));y=Math.max(0,Math.min(image.height-1,y));return [...image.data.subarray((y*image.width+x)*4,(y*image.width+x)*4+4)];};
 return mix(mix(at(x0,y0),at(x0+1,y0),fx),mix(at(x0,y0+1),at(x0+1,y0+1),fx),fy);
}
export function atlasReference(x,y,state,images,width,height){
 const {camera,islandId,ball}=state,dx=x-width/2,dy=y-height/2;
 const basis=camera.basis??{a:1,b:0,c:0,d:1},det=basis.a*basis.d-basis.b*basis.c;
 const px=(basis.d*dx-basis.c*dy)/det,py=(-basis.b*dx+basis.a*dy)/det;
 const p=spherePixel(islandId,camera,px,py,ball);if(!p)return null;
 const Rp=WORLD_GEO.Rw*camera.zoom,edge=Math.hypot(px,py)/(Rp*horizonRatio(ball));if(edge>.86)return null;
 const len=Math.hypot(px,py),v=[len?px/len*edge:0,len?-py/len*edge:0,Math.sqrt(1-edge*edge)];
 const lit=dot(v,light)/ln,shade=(1-smooth(.12,.3,lit))*ball,highlight=smooth(.8,.95,lit)*ball,rim=smooth(.94,1,edge)**2*.45*ball;
 const lighting=c=>mix(c.map((c,k)=>c*(1-shade+shade*[.72,.8,.98][k])+[.06,.07,.08][k]*highlight),[.55,.82,1],rim).map(c=>Math.max(0,Math.min(255,c*255)));
 const sea=lighting(mix([110/255,201/255,222/255],[.2,.52,.86],ball));
 let best=null;
 for(const i of WORLD_ISLANDS){
  const st=state.stickers?.find(s=>s.kind==='island'&&s.id===i.id);
  if(state.stickers&&!st)continue;
  if(dot(p,i.center)<0)continue;
  const m=mapOf(i.id),sphere=logMap(i,p,WORLD_GEO.Rw),k=st?.onBall??paintWeight(ball);
  // A centre Jacobian only describes an infinitesimal neighbourhood. Painting
  // uses the inverse sphere chart at EVERY pixel, blended with the rigid map.
  let q=sphere;
  if(st&&k<1){
   const r=st.rigid??st,det=r.a*r.d-r.b*r.c,dx=x-r.x,dy=y-r.y;
   q={x:(r.d*dx-r.c*dy)/det*(1-k)+sphere.x*k,y:(-r.b*dx+r.a*dy)/det*(1-k)+sphere.y*k};
  }
  const u=.5+q.x/m.width,v=.5+q.y/m.height;
  if(u<=0||v<=0||u>=1||v>=1)continue;
  const image=images.get(i.theme??'home');if(!image)continue;
  const c=bilinear(image,u,v),distance=q.x*q.x+q.y*q.y;if(c[3]<=.255)continue;
  const opaque=c[3]>127.5,bestOpaque=best?.c[3]>127.5;
  if(!best||(opaque&&!bestOpaque)||(opaque===bestOpaque&&distance<best.distance))best={c,distance,live:st?.mode==='live'};
 }
 // Only test truly opaque interior colours; preserve the original strict
 // opacity/colour thresholds and skip the live scene's animated content.
 if(!best||best.live||best.c[3]<254)return null;
 return {colour:lighting(best.c.slice(0,3).map(c=>c/255)),sea};
}
export function midZoomQuality(png,state,images){
 const {width,height,data}=png,errors=[],opacity=[],sharp=[],blurred=[];
 for(let y=12;y<height-12;y+=4)for(let x=12;x<width-12;x+=4){
  const ref=atlasReference(x+.5,y+.5,state,images,width,height);if(!ref)continue;
  const at=(y*width+x)*4,c=[data[at],data[at+1],data[at+2]],r=ref.colour;
  const delta=r.map((v,k)=>v-ref.sea[k]),norm=dot(delta,delta);if(norm<900)continue;
  errors.push(c.reduce((n,v,k)=>n+Math.abs(v-r[k]),0)/3);
  opacity.push(dot(c.map((v,k)=>v-ref.sea[k]),delta)/norm);
  const neighbours=[[-1,0],[1,0],[0,-1],[0,1]].map(([dx,dy])=>atlasReference(x+.5+dx,y+.5+dy,state,images,width,height));
  if(neighbours.some(p=>!p))continue;
  const b=r.map((v,k)=>(v+neighbours.reduce((n,p)=>n+p.colour[k],0))/5);
  const contrast=Math.hypot(...b.map((v,k)=>v-r[k]));if(contrast<4)continue;
  sharp.push(c.reduce((n,v,k)=>n+(v-r[k])**2,0)/3);
  blurred.push(c.reduce((n,v,k)=>n+(v-b[k])**2,0)/3);
 }
 const medianOpacity=median(opacity),medianError=median(errors),p90Error=quantile(errors,.9),avg=a=>a.reduce((n,v)=>n+v,0)/Math.max(1,a.length);
 const blurToSharpErrorRatio=sharp.length?avg(blurred)/Math.max(.01,avg(sharp)):null;
 return {method:'Opaque atlas colours and sharp edges against an independently sampled CPU sphere reference',samples:errors.length,edgeSamples:sharp.length,medianOpacity,medianColourError:medianError,p90ColourError:p90Error,blurToSharpErrorRatio,
  opacityPassed:errors.length>500&&medianOpacity>.9&&medianOpacity<1.1&&medianError<10&&p90Error<28,
  blurPassed:sharp.length>30&&blurToSharpErrorRatio>.8};
}
