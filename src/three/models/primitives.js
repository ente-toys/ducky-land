import * as THREE from 'three';
export { THREE };
export const P={ink:0x282d28,yellow:0xf4d93b,orange:0xff814a,leaf:0x58bf43,leafDark:0x3e9f2f,grass:0x8ed66b,water:0x7fd0f3,blue:0x4794d8,wood:0xd58e50,woodDark:0xaf6734,stone:0xe6e2da,metal:0x727272,cream:0xfff4c5,red:0xf0463f,pink:0xff669d,purple:0x8e75dd,white:0xffffff};
const materials=new Map(),geometries=new Map();
export function mat(color=P.cream,options={}){const key=JSON.stringify([color,options]);if(!materials.has(key)){const m=new THREE.MeshToonMaterial({color,...options});materials.set(key,m);}return materials.get(key);}
const cached=(key,fn)=>{if(!geometries.has(key))geometries.set(key,fn());return geometries.get(key);};
export const group=()=>new THREE.Group();
export function mesh(g,geometry,color,x=0,y=0,z=0,options={}){const m=new THREE.Mesh(geometry,mat(color,options));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
export function box(g,w,h,d,color,x=0,y=0,z=0){return mesh(g,cached(`b${w},${h},${d}`,()=>new THREE.BoxGeometry(w,h,d)),color,x,y,z);}
export function sphere(g,rx,ry,rz,color,x=0,y=0,z=0){const m=mesh(g,cached('sphere',()=>new THREE.SphereGeometry(1,12,8)),color,x,y,z);m.scale.set(rx,ry,rz);return m;}
export function cylinder(g,top,bottom,h,color,x=0,y=0,z=0,segments=12){return mesh(g,cached(`c${top},${bottom},${h},${segments}`,()=>new THREE.CylinderGeometry(top,bottom,h,segments)),color,x,y,z);}
export function cone(g,r,h,color,x=0,y=0,z=0,segments=12){return cylinder(g,0,r,h,color,x,y,z,segments);}
export function torus(g,r,tube,color,x=0,y=0,z=0){return mesh(g,cached(`t${r},${tube}`,()=>new THREE.TorusGeometry(r,tube,6,24)),color,x,y,z);}
export function line(g,points,r,color){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(g,new THREE.TubeGeometry(curve,Math.max(8,points.length*5),r,5,false),color);}
export function extrude(g,points,depth,color,x=0,y=0,z=0,bevel=.025){const s=new THREE.Shape();points.forEach(([a,b],i)=>i?s.lineTo(a,b):s.moveTo(a,b));s.closePath();return mesh(g,new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:bevel}),color,x,y,z);}
export function leaf(g,color,x,y,z,size=.15){return sphere(g,size,.035,size*.48,color,x,y,z);}
export function label(g,text,w,h,x,y,z,bg='#fff4c5',fg='#303b2c'){if(typeof document==='undefined')return box(g,w,h,.015,P.cream,x,y,z);const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.fillStyle=fg;ctx.font='bold 58px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,66,480);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex}));m.position.set(x,y,z);g.add(m);return m;}
export function disposeShared(){for(const g of geometries.values())g.dispose();for(const m of materials.values())m.dispose();geometries.clear();materials.clear();}
