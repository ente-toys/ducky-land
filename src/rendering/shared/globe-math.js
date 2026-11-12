export class Vector2 {
  constructor(x=0,y=0){this.set(x,y);}
  set(x,y){this.x=x;this.y=y;return this;}
}

export class Vector3 {
  constructor(x=0,y=0,z=0){this.set(x,y,z);}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  copy(v){return this.set(v.x,v.y,v.z);}
  clone(){return new Vector3(this.x,this.y,this.z);}
  toArray(){return [this.x,this.y,this.z];}
  dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
  lengthSq(){return this.dot(this);}
  length(){return Math.sqrt(this.lengthSq());}
  distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}
  addScaledVector(v,k){return this.set(this.x+v.x*k,this.y+v.y*k,this.z+v.z*k);}
  sub(v){return this.addScaledVector(v,-1);}
  multiplyScalar(k){return this.set(this.x*k,this.y*k,this.z*k);}
  divideScalar(k){return this.multiplyScalar(1/k);}
  normalize(){return this.divideScalar(this.length()||1);}
  crossVectors(a,b){return this.set(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);}
  projectOnPlane(normal){return this.addScaledVector(normal,-this.dot(normal)/(normal.lengthSq()||1));}
  applyQuaternion(q){
    const {x,y,z}=this;
    const tx=2*(q.y*z-q.z*y),ty=2*(q.z*x-q.x*z),tz=2*(q.x*y-q.y*x);
    return this.set(x+q.w*tx+q.y*tz-q.z*ty,y+q.w*ty+q.z*tx-q.x*tz,z+q.w*tz+q.x*ty-q.y*tx);
  }
  applyMatrix4({elements:m}){
    const {x,y,z}=this,w=1/(m[3]*x+m[7]*y+m[11]*z+m[15]);
    return this.set((m[0]*x+m[4]*y+m[8]*z+m[12])*w,(m[1]*x+m[5]*y+m[9]*z+m[13])*w,(m[2]*x+m[6]*y+m[10]*z+m[14])*w);
  }
  transformDirection({elements:m}){
    const {x,y,z}=this;
    return this.set(m[0]*x+m[4]*y+m[8]*z,m[1]*x+m[5]*y+m[9]*z,m[2]*x+m[6]*y+m[10]*z).normalize();
  }
  project(camera){return this.applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);}
  unproject(camera){return this.applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);}
}

export class Quaternion {
  constructor(x=0,y=0,z=0,w=1){this.set(x,y,z,w);}
  set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;}
  copy(q){return this.set(q.x,q.y,q.z,q.w);}
  clone(){return new Quaternion(this.x,this.y,this.z,this.w);}
  toArray(){return [this.x,this.y,this.z,this.w];}
  angleTo(q){return 2*Math.acos(Math.min(1,Math.abs(this.x*q.x+this.y*q.y+this.z*q.z+this.w*q.w)));}
  invert(){return this.set(-this.x,-this.y,-this.z,this.w);}
  normalize(){
    const n=Math.hypot(this.x,this.y,this.z,this.w);
    return n?this.set(this.x/n,this.y/n,this.z/n,this.w/n):this.set(0,0,0,1);
  }
  setFromAxisAngle(axis,angle){
    const s=Math.sin(angle/2);
    return this.set(axis.x*s,axis.y*s,axis.z*s,Math.cos(angle/2));
  }
  setFromUnitVectors(a,b){
    const w=1+a.dot(b);
    if(w<1e-8)return (Math.abs(a.x)>Math.abs(a.z)?this.set(-a.y,a.x,0,0):this.set(0,-a.z,a.y,0)).normalize();
    return this.set(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x,w).normalize();
  }
  setFromBasis(e,n,c){
    const trace=e[0]+n[1]+c[2];
    if(trace>0){
      const s=2*Math.sqrt(trace+1);
      return this.set((n[2]-c[1])/s,(c[0]-e[2])/s,(e[1]-n[0])/s,s/4);
    }
    if(e[0]>n[1]&&e[0]>c[2]){
      const s=2*Math.sqrt(1+e[0]-n[1]-c[2]);
      return this.set(s/4,(n[0]+e[1])/s,(c[0]+e[2])/s,(n[2]-c[1])/s);
    }
    if(n[1]>c[2]){
      const s=2*Math.sqrt(1+n[1]-e[0]-c[2]);
      return this.set((n[0]+e[1])/s,s/4,(c[1]+n[2])/s,(c[0]-e[2])/s);
    }
    const s=2*Math.sqrt(1+c[2]-e[0]-n[1]);
    return this.set((c[0]+e[2])/s,(c[1]+n[2])/s,s/4,(e[1]-n[0])/s);
  }
  multiply(q){return this.multiplyQuaternions(this,q);}
  premultiply(q){return this.multiplyQuaternions(q,this);}
  multiplyQuaternions(a,b){
    return this.set(a.x*b.w+a.w*b.x+a.y*b.z-a.z*b.y,a.y*b.w+a.w*b.y+a.z*b.x-a.x*b.z,
      a.z*b.w+a.w*b.z+a.x*b.y-a.y*b.x,a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z);
  }
  slerpQuaternions(a,b,t){
    let dot=a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w;
    const sign=dot<0?-1:1;
    dot=Math.abs(dot);
    const angle=Math.acos(Math.min(1,dot)),sin=Math.sin(angle);
    const x=sin>1e-7?Math.sin((1-t)*angle)/sin:1-t;
    const y=sign*(sin>1e-7?Math.sin(t*angle)/sin:t);
    return this.set(x*a.x+y*b.x,x*a.y+y*b.y,x*a.z+y*b.z,x*a.w+y*b.w).normalize();
  }
}

export function transformMatrix(out,q,p,s={x:1,y:1,z:1}){
  const {x,y,z,w}=q;
  out.set([
    (1-2*(y*y+z*z))*s.x,2*(x*y+w*z)*s.x,2*(x*z-w*y)*s.x,0,
    2*(x*y-w*z)*s.y,(1-2*(x*x+z*z))*s.y,2*(y*z+w*x)*s.y,0,
    2*(x*z+w*y)*s.z,2*(y*z-w*x)*s.z,(1-2*(x*x+y*y))*s.z,0,
    p.x,p.y,p.z,1
  ]);
  return out;
}

export class PerspectiveCamera {
  constructor(fov,aspect,near,far){
    Object.assign(this,{fov,aspect,near,far,position:new Vector3(),quaternion:new Quaternion()});
    for(const key of ['matrixWorld','matrixWorldInverse','projectionMatrix','projectionMatrixInverse'])this[key]={elements:new Float64Array(16)};
    this.updateProjectionMatrix();
    this.updateMatrixWorld();
  }
  updateMatrixWorld(){
    transformMatrix(this.matrixWorld.elements,this.quaternion,this.position);
    const inverse=this.quaternion.clone().invert();
    transformMatrix(this.matrixWorldInverse.elements,inverse,this.position.clone().multiplyScalar(-1).applyQuaternion(inverse));
  }
  updateProjectionMatrix(){
    const y=1/Math.tan(this.fov*Math.PI/360),x=y/this.aspect;
    const z=-(this.far+this.near)/(this.far-this.near),w=-2*this.far*this.near/(this.far-this.near);
    this.projectionMatrix.elements.set([x,0,0,0,0,y,0,0,0,0,z,-1,0,0,w,0]);
    this.projectionMatrixInverse.elements.set([1/x,0,0,0,0,1/y,0,0,0,0,0,1/w,0,0,-1,z/w]);
  }
}

export const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const lerp=(a,b,t)=>a+(b-a)*t;
export function smoothstep(value,min,max){
  const t=clamp((value-min)/(max-min),0,1);
  return t*t*(3-2*t);
}
