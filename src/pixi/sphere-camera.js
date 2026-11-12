import {mapPoint,localPoint,spherePoint} from './sphere-coordinates.js';
import {flatRigid} from './rigid.js';

export const IDENTITY_BASIS=Object.freeze({a:1,b:0,c:0,d:1});
export function landingBasis(from,to,point,prior=IDENTITY_BASIS){
 const p=mapPoint(to,from,point),x=mapPoint(to,from,{x:point.x+1,y:point.y}),y=mapPoint(to,from,{x:point.x,y:point.y+1});
 const a=prior.a*(x.x-p.x)+prior.c*(x.y-p.y),b=prior.b*(x.x-p.x)+prior.d*(x.y-p.y);
 const c=prior.a*(y.x-p.x)+prior.c*(y.y-p.y),d=prior.b*(y.x-p.x)+prior.d*(y.y-p.y);
 const angle=Math.atan2(b-c,a+d),co=Math.cos(angle),si=Math.sin(angle);
 return {angle,xx:co*a+si*b,xy:co*c+si*d,yx:-si*a+co*b,yy:-si*c+co*d};
}
export function rigidLandingBasis(from,to,prior=IDENTITY_BASIS,r=flatRigid(from,to)){
 const a=prior.a*r.a+prior.c*r.b,b=prior.b*r.a+prior.d*r.b,c=prior.a*r.c+prior.c*r.d,d=prior.b*r.c+prior.d*r.d;
 const angle=Math.atan2(b-c,a+d),co=Math.cos(angle),si=Math.sin(angle);
 return {angle,xx:co*a+si*b,xy:co*c+si*d,yx:-si*a+co*b,yy:-si*c+co*d};
}
export function easeLandingBasis(start,progress){
 if(progress>=1)return {...IDENTITY_BASIS};
 const k=Math.pow(1-Math.max(0,Math.min(1,progress)),3),a=start.angle*k,co=Math.cos(a),si=Math.sin(a);
 const xx=1+(start.xx-1)*k,xy=start.xy*k,yx=start.yx*k,yy=1+(start.yy-1)*k;
 return {a:co*xx-si*yx,b:si*xx+co*yx,c:co*xy-si*yy,d:si*xy+co*yy};
}
export function canonicalCamera(id,camera){return Object.assign(camera,localPoint(id,spherePoint(id,camera)));}
export function turnLongitude(id,camera,radians){
 const p=spherePoint(id,camera),c=Math.cos(radians),s=Math.sin(radians);
 return Object.assign(camera,localPoint(id,[p[0]*c+p[2]*s,p[1],p[2]*c-p[0]*s]));
}
export function cameraMatrix(camera,width,height,tilt=1){
 const q=camera.basis??IDENTITY_BASIS,z=camera.zoom,a=q.a*z,b=q.b*z,c=q.c*z*tilt,d=q.d*z*tilt;
 return {a,b,c,d,tx:width/2-a*camera.x-c*camera.y,ty:height/2-b*camera.x-d*camera.y};
}

export function cameraSpan(camera,width,height){
 const b=camera.basis;if(!b)return {width,height};
 const det=Math.abs(b.a*b.d-b.b*b.c);
 return {width:(Math.abs(b.d)*width+Math.abs(b.c)*height)/det,height:(Math.abs(b.b)*width+Math.abs(b.a)*height)/det};
}
