import {spherePoint,localPoint,viewFrame} from './sphere-coordinates.js';
import {unit} from './sphere.js';
import {WORLD_GEO} from './world-map.js';

export const horizonRatio=ball=>(1-ball)*Math.PI/2+ball;
// Inverse of r = (1-ball)*angle + ball*sin(angle), on the FRONT hemisphere.
// Both terms are monotone here, so islands cannot fold into a ribbon or repeat.
export function lensAngle(radius,ball){
 const max=horizonRatio(ball),r=Math.max(0,Math.min(max,radius));
 if(ball<1e-6)return r;
 if(ball>1-1e-6)return Math.asin(Math.min(1,r));
 let a=Math.min(Math.PI/2,r);
 for(let i=0;i<7;i++)a=Math.max(0,Math.min(Math.PI/2,a-((1-ball)*a+ball*Math.sin(a)-r)/Math.max(1e-5,1-ball+ball*Math.cos(a))));
 return a;
}
export function spherePixel(id,camera,px,py,ball){
 const Rp=WORLD_GEO.Rw*camera.zoom,len=Math.hypot(px,py);
 if(ball>0&&len>Rp*horizonRatio(ball))return null;
 const flat=spherePoint(id,{x:camera.x+px/camera.zoom,y:camera.y+py/camera.zoom});
 if(ball<1e-6)return flat;
 const v=viewFrame(id,camera),a=lensAngle(len/Rp,ball);
 const p=v.center.map((x,k)=>x*Math.cos(a)+(len?v.east[k]*px/len-v.north[k]*py/len:0)*Math.sin(a));
 const t=Math.min(1,ball/.25),blend=t*t*(3-2*t);
 return unit(flat.map((x,k)=>x*(1-blend)+p[k]*blend));
}
export function pixelChart(id,camera,px,py,ball){const p=spherePixel(id,camera,px,py,ball);return p?localPoint(id,p):null;}
