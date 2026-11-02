import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import world from '../../rive/web/world.json' with {type:'json'};
import sceneManifest from './scene-manifest.json' with {type:'json'};
import {geometry} from '../../rive/web/island-geometry.mjs';
import {createAsset} from './registry.js';
import {P,group,mesh,mat,box,sphere,cylinder,label} from './models/primitives.js';
export {world,sceneManifest};
export const toScene=(x,y)=>new THREE.Vector3((x-world.width/2)/100,0,(y-world.height/2)/100);
export const toWorld=p=>({x:p.x*100+world.width/2,y:p.z*100+world.height/2});
export function heightAt(x,y){
 const h=sceneManifest.hill,d=((x-h.x)/h.rx)**2+((y-h.y)/h.ry)**2;let elevation=d<1?h.height*Math.min(1,(1-d)*3):0;
 const stair=sceneManifest.stairs,index=Math.floor((y-stair.y+12)/stair.step);if(index>=0&&index<stair.count&&Math.abs(x-stair.x)<(135+index*6)/2)elevation=Math.max(elevation,.685-index*.07);
 for(const bridge of world.bridges)if(Math.abs(x-bridge.x)<bridge.w/2&&Math.abs(y-bridge.y)<bridge.h/2)elevation=.26+.10*(1-((x-bridge.x)/(bridge.w/2))**2);
 for(const way of world.walkways){const dx=way.b[0]-way.a[0],dy=way.b[1]-way.a[1],t=Math.max(0,Math.min(1,((x-way.a[0])*dx+(y-way.a[1])*dy)/(dx*dx+dy*dy)));if(Math.hypot(x-way.a[0]-dx*t,y-way.a[1]-dy*t)<way.w/2)elevation=Math.max(elevation,.14);}
 return elevation;
}
const alias={
 'Drip fountain':['landmarks/drip-fountain',4.6], 'Market stall':['buildings/stall-fruit',3.1], 'Plaza bench':['street/bench-wood',2.4],'Plaza lantern':['street/lamp-lantern',.8],'Flower planter':['street/planter-flowers',1.1],'Market bunting':['street/bunting',10.5],
 'Lily bridge':['landmarks/lily-bridge',9.2],'Pond reeds':['nature/reeds',1.1],'Pond bench':['street/bench-park',2.4], 'Croissant tree':['landmarks/bread-croissant',1.9],'Baguette tree':['landmarks/bread-baguette',1.45],'Forest picnic':['street/picnic-table',3.1],
 'Little library':['landmarks/book-library',5.5],'Outdoor reading':['street/picnic-table',2.6],'Hill tree':['nature/tree-round',2.5],'Library flowers':['street/planter-flowers',1.1],
 'Racing sailboat':['water/sailboat',3],'Blue racing sailboat':['water/sailboat',2.4],'Finish pole':['street/bollard',.5],'Race finish banner':['landmarks/race-finish',2.35],'Race bench':['street/bench-park',2.4],
 'Rubber duck lighthouse':['landmarks/duck-beacon',2.5],'Beach umbrella':['street/umbrella-garden',2.6],'Beach blanket':['beach/towel-striped',2.1],'Beach shell':['beach/shell-scallop',.8],'Coast rock':['nature/rock-boulder',1.4],'Drip tree':['nature/tree-oak',2.9],
};
export function placementFor(p,index){if(p.name.startsWith('Wayfinding'))return ['street/signpost-three-way',1.9];const a=alias[p.name];if(!a)throw new Error(`Unmapped island prop ${p.name}`);if(p.name==='Market stall')return [`buildings/${['stall-bread','stall-fruit','stall-flower'][index%3]}`,3.1];return a;}
function patch(parent,points,color,y=0,depth=0){const shape=new THREE.Shape();points.forEach(([x,z],i)=>{const p=toScene(x,z);i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z);});shape.closePath();const geo=depth?new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:24}):new THREE.ShapeGeometry(shape,24);geo.rotateX(-Math.PI/2);const m=mesh(parent,geo,color,0,y-depth,0);return m;}
const ellipsePoints=(x,y,rx,ry)=>Array.from({length:64},(_,i)=>[x+Math.cos(i*Math.PI/32)*rx,y+Math.sin(i*Math.PI/32)*ry]);
function ribbon(parent,points,width,color,y=.04){const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>{const p=toScene(x,z);p.y=y+heightAt(x,z);return p;}));const verts=[],indices=[];for(let i=0;i<=80;i++){const p=curve.getPoint(i/80),t=curve.getTangent(i/80),normal=new THREE.Vector3(-t.z,0,t.x).normalize().multiplyScalar(width/200);verts.push(p.x+normal.x,p.y,p.z+normal.z,p.x-normal.x,p.y,p.z-normal.z);if(i<80){const a=i*2;const point=toWorld(curve.getPoint((i+.5)/80)),s=sceneManifest.stairs;const stairs=Math.abs(point.x-s.x)<100&&point.y>s.y-20&&point.y<s.y+s.count*s.step;if(!stairs)indices.push(a,a+2,a+1,a+1,a+2,a+3);}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();return mesh(parent,geo,color);}
// Merge static meshes by material; dynamic scenery keeps its own transforms.
export function batchStatic(root,spatial=false){root.updateMatrixWorld(true);const buckets=new Map(),original=[];root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||o.material.map)return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.deleteAttribute('uv');g.deleteAttribute('color');const cell=o.getWorldPosition(new THREE.Vector3());const key=o.material.uuid+(spatial?`:${Math.floor(cell.x/8)}:${Math.floor(cell.z/8)}`:'');if(!buckets.has(key))buckets.set(key,{material:o.material,geometries:[]});buckets.get(key).geometries.push(g);original.push(o);});const merged=group();for(const b of buckets.values()){const geo=mergeGeometries(b.geometries);if(geo){const m=new THREE.Mesh(geo,b.material);m.castShadow=true;m.receiveShadow=true;merged.add(m);}b.geometries.forEach(g=>g.dispose());}original.forEach(m=>m.removeFromParent());root.add(merged);return merged;}
export async function buildWorld(scene){const terrain=group(),staticProps=group(),dynamic=[],waterMeshes=[];scene.add(terrain,staticProps);
const coast=world.coast;patch(terrain,coast.map(([x,y])=>[2800+(x-2800)*1.04,2150+(y-2150)*1.04]),P.cream,-.03,.65);patch(terrain,coast,P.grass,.015,.08);
for(const isle of world.islets){patch(terrain,ellipsePoints(...isle),P.cream,-.03,.4);patch(terrain,ellipsePoints(isle[0],isle[1],isle[2]*.83,isle[3]*.78),P.grass,.02,.08);}
patch(terrain,coast.map(([x,y])=>[2800+(x-2800)*1.08,2150+(y-2150)*1.08]),0xb5e7f7,-.08);
const track=sceneManifest.raceTrack,clearing=sceneManifest.clearing;patch(terrain,ellipsePoints(track.x,track.y,track.rx,track.ry),P.cream,.025);patch(terrain,ellipsePoints(clearing.x,clearing.y,clearing.rx,clearing.ry),0xb5de82,.025);
for(const lake of world.water){patch(terrain,ellipsePoints(lake.x,lake.y,lake.rx+25,lake.ry+25),P.cream,.04);const water=patch(terrain,ellipsePoints(lake.x,lake.y,lake.rx,lake.ry),P.water,.055);waterMeshes.push(water);}
const beach=sceneManifest.beach,plaza=sceneManifest.plaza;patch(terrain,ellipsePoints(beach.x,beach.y,beach.rx,beach.ry),P.cream,.03);patch(terrain,ellipsePoints(plaza.x,plaza.y,plaza.rx,plaza.ry),0xffefbc,.035);
const hill=sceneManifest.hill,hillShape=new THREE.RingGeometry(0,1,64,16);hillShape.rotateX(-Math.PI/2);const positions=hillShape.attributes.position;for(let i=0;i<positions.count;i++){const x=hill.x+positions.getX(i)*hill.rx,z=hill.y+positions.getZ(i)*hill.ry,p=toScene(x,z);positions.setXYZ(i,p.x,heightAt(x,z)+.02,p.z);}hillShape.computeVertexNormals();mesh(terrain,hillShape,0x83cb64);
for(const points of sceneManifest.paths)ribbon(terrain,points,115,P.cream,.06);
for(let i=0;i<sceneManifest.stairs.count;i++){const p=toScene(sceneManifest.stairs.x,sceneManifest.stairs.y+i*sceneManifest.stairs.step);box(terrain,(135+i*6)/100,.07, .24,P.stone,p.x,.65-i*.07,p.z);}
for(const way of world.walkways){const a=toScene(...way.a),b=toScene(...way.b),length=a.distanceTo(b);const board=group();board.position.copy(a.clone().add(b).multiplyScalar(.5));board.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);const n=Math.ceil(length/.22);for(let i=0;i<n;i++)box(board,way.w/100,.13,length/n-.018,P.wood,0,.1,(i+.5)*length/n-length/2);terrain.add(board);}
for(let i=0;i<world.props.length;i++){const p=world.props[i],[id,width]=placementFor(p,i);const model=await createAsset(id);if(p.name==='Racing sailboat')model.traverse(o=>{if(o.name==='sail')o.material=mat(P.red);});if(p.name==='Beach umbrella')model.traverse(o=>{if(o.material?.color?.getHex()===P.pink)o.material=mat(p.x<4800?P.red:P.blue,{side:THREE.DoubleSide});});model.scale.multiplyScalar(width);if(p.name==='Lily bridge'){const b=new THREE.Box3().setFromObject(model);model.scale.z*=1.12/(b.max.z-b.min.z);}model.position.copy(toScene(p.x,p.y));model.position.y=p.name==='Lily bridge'?.08:heightAt(p.x,p.y)+.08;model.userData.baseY=model.position.y;model.userData.phase=p.x*.004+p.y*.002;
if(/bunting|umbrella|tree|reeds|flower|sailboat|rowboat|bread-baguette|bread-croissant|race-finish/.test(id)){dynamic.push(model);scene.add(model);}else staticProps.add(model);

}
// Coordinates are read from the existing RML, never regenerated by the legacy build.
const {walkable:canPlace}=geometry(world);let seed=53;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
for(const [i,d]of sceneManifest.decorations.entries()){
 const p=toScene(d.x,d.y);
 if(d.kind==='Plaza cobble'||d.kind==='Beach pebble'){const radius=d.kind==='Plaza cobble'?.15:.035;sphere(staticProps,radius,.025,radius*.65,d.kind==='Plaza cobble'?0xe3d7aa:0xd5c8a1,p.x,.065,p.z);continue;}
 if(d.kind==='Grass tuft')continue;if(d.kind==='Meadow patch'){patch(terrain,ellipsePoints(d.x,d.y,d.rx,d.ry),0x87cd64,.024);continue;}
 const id=d.kind==='Pond lily'?(d.flower?'nature/lily-pad-flower':'nature/lily-pad-small'):'water/buoy-red';
 const model=await createAsset(id);model.scale.multiplyScalar(d.kind==='Pond lily'?.65:.35);model.position.copy(p);model.position.y=.08;
 if(d.kind==='Race marker'&&i%2===0)model.traverse(o=>{if(o.material?.color?.getHex()===P.red)o.material=mat(0xffae2c);});
 model.userData.baseY=.08;model.userData.phase=i;dynamic.push(model);scene.add(model);
}
// Repeated meadow details use instancing instead of one mesh per tuft.
const wind={value:0},windStrength={value:1},grassMaterial=mat(0x5baa43).clone();
grassMaterial.onBeforeCompile=shader=>{shader.uniforms.uWindTime=wind;shader.uniforms.uWindStrength=windStrength;shader.vertexShader='uniform float uWindTime; uniform float uWindStrength;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
 transformed.x += sin(uWindTime*1.5+instanceMatrix[3].x*.35+instanceMatrix[3].z*.2)*max(0.0,position.y+.06)*.3*uWindStrength;
#endif`);};grassMaterial.customProgramCacheKey=()=> 'island-grass-wind';
const tuftGeo=new THREE.ConeGeometry(.035,.12,3),tufts=new THREE.InstancedMesh(tuftGeo,grassMaterial,320);const dummy=new THREE.Object3D(),{walkable}=geometry(world);let count=0;for(const d of sceneManifest.decorations.filter(d=>d.kind==='Grass tuft')){if(count>=320||!walkable(d.x,d.y))continue;dummy.position.copy(toScene(d.x,d.y));dummy.position.y=.09+heightAt(d.x,d.y);dummy.rotation.y=random()*Math.PI;dummy.updateMatrix();tufts.setMatrixAt(count++,dummy.matrix);}tufts.count=count;terrain.add(tufts);
batchStatic(terrain);batchStatic(staticProps,true);
return{terrain,staticProps,dynamic,waterMeshes,decorations:tufts,update(time,reduced){wind.value=time;windStrength.value=reduced?0:1;if(reduced){for(const o of dynamic){o.rotation.z=0;o.position.y=o.userData.baseY;}return;}const gust=.35+.65*(.5+.5*Math.sin(time*.38));for(const o of dynamic){const name=o.name,phase=o.userData.phase;if(/boat|buoy|lily/.test(name)){o.position.y=o.userData.baseY+Math.sin(time*1.4+phase)*.035;o.rotation.z=Math.sin(time*.9+phase)*.02;}else{o.rotation.z=Math.sin(time*1.5+phase)*.018*gust;}}}};
}
