import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import * as THREE from 'three';
import {Scene} from '../src/rendering/pixi/globe-mesh.js';
import {createIsletStanding,isletCardMaterial} from '../src/rendering/three/three-islet-props.js';
import {ISLETS,ISLET_META} from '../src/world/islets.js';

test('one upright islet drawing stays opaque across zoom ownership and disappears behind the globe',async()=>{
 const saved={document:globalThis.document,DOMParser:globalThis.DOMParser,XMLSerializer:globalThis.XMLSerializer};
 globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return createCanvas(1,1);}};
 globalThis.DOMParser=DOMParser;globalThis.XMLSerializer=XMLSerializer;
 const rasterize=async svg=>{const c=createCanvas(512,512);c.getContext('2d').drawImage(await loadImage(Buffer.from(svg)),0,0,512,512);return c;};
 const scene=new Scene(),frame=ISLETS.find(i=>i.art==='05-lighthouse-rock'),blend={value:0};
 let view;
 try{
  view=await createIsletStanding(scene,frame,readFileSync(new URL('../public/pixi-art/islets/05-lighthouse-rock.svg',import.meta.url),'utf8'),blend,{rasterize});
  assert.equal(view.props.length,ISLET_META[frame.art].tallPieces.length,'every source piece has exactly one upright owner');
  const p=view.props[0];p.anchor.set(0,0,1.001);
  const camera=new THREE.PerspectiveCamera(35,1,.01,20);camera.position.z=3;camera.updateMatrixWorld(true);
  view.update(new THREE.Quaternion(),camera);
  assert.equal(p.mesh.visible,true);assert.equal(p.mesh.material.opacity,1,'whole-globe zoom does not fade the upright drawing');
  blend.value=.5;view.update(new THREE.Quaternion(),camera);assert.equal(p.mesh.material.opacity,1,'no translucent duplicate at intermediate zoom');
  blend.value=1;view.update(new THREE.Quaternion(),camera);assert.equal(p.mesh.material.opacity,1);
  const rim=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.8);
  view.update(rim,camera);const rimOpacity=p.mesh.material.opacity;
  assert.ok(rimOpacity>0&&rimOpacity<1,'broad rock base fades gradually before ground is severely foreshortened');
  blend.value=0;view.update(rim,camera);assert.equal(p.mesh.material.opacity,rimOpacity,'limb fade is geometric, not a zoom crossfade');
  view.update(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),1),camera);
  assert.equal(p.mesh.visible,false,'grazing cards hide before their base overhang becomes pronounced');
  assert.ok(view.ground.image,'the underlying ground texture remains available at the limb');
  view.update(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI),camera);
  assert.equal(p.mesh.visible,false,'back-facing anchors cannot leak through the ocean');
  camera.aspect=1.5;camera.updateProjectionMatrix();
  const identity=new THREE.Quaternion(),flat={x:700,y:350,pixelsPerUnit:400,blend:.5,width:1200,height:800};
  view.update(identity,camera);const start=p.mesh.position.clone().project(camera);
  view.update(identity,camera,()=>flat);let ndc=p.mesh.position.clone().project(camera);
  assert.ok(Math.abs(ndc.x-(start.x+(flat.x/1200*2-1-start.x)*.5))<1e-6,'one card moves continuously between globe and native foot positions');
  flat.blend=1;view.update(identity,camera,()=>flat);ndc=p.mesh.position.clone().project(camera);
  assert.ok(Math.abs((ndc.x+1)*600-flat.x)<1e-6);assert.ok(Math.abs((1-ndc.y)*400-flat.y)<1e-6,'flat handoff foot exactly matches the native prop');
  const depth=-p.mesh.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
  assert.ok(Math.abs(p.mesh.scale.x/(2*depth*Math.tan(camera.fov*Math.PI/360))*800-flat.pixelsPerUnit)<1e-6,'flat handoff preserves native prop pixel scale');
  assert.equal(p.mesh.material.userData.flatBlend.value,1,'native screen ownership permits upright ink outside the former globe silhouette');
  assert.ok(p.mesh.renderOrder>101,'single scenery owner draws above both live island surface and fullscreen handoff');
 }finally{
  if(view){view.ground.dispose();for(const {mesh}of view.props){mesh.geometry.dispose();mesh.material.map.dispose();mesh.material.dispose();}}
  Object.assign(globalThis,saved);
 }
});

test('upright cards keep the foot intact but shader clips ink outside the curved planet silhouette',()=>{
 const texture=new THREE.Texture(),material=isletCardMaterial(texture),shader={uniforms:{},vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader};
 material.onBeforeCompile(shader);
 assert.equal(material.depthTest,false,'sphere depth must not slice a standing card through its base');
 assert.equal(material.depthWrite,false);
 assert.equal(shader.uniforms.isletGlobeRadius.value,1.001);
 assert.ok(shader.vertexShader.includes('isletWorldPoint=(modelMatrix*vec4(transformed,1.)).xyz'));
 assert.ok(shader.fragmentShader.includes('if(isletFlatBlend<.001&&(isletAlong>=0.||isletDisc<0.))discard;'),'planet ray misses discard card pixels in black space before flattening');
 const camera=new THREE.Vector3(0,0,3),sphere=new THREE.Sphere(new THREE.Vector3(),shader.uniforms.isletGlobeRadius.value);
 for(const [point,visible]of [[new THREE.Vector3(0,0,1.001),true],[new THREE.Vector3(1.2,0,.3),false]]){
  const ray=new THREE.Ray(camera,point.clone().sub(camera).normalize());
  assert.equal(ray.intersectsSphere(sphere),visible,'front foot remains inside the silhouette; outward rim ink does not');
 }
 texture.dispose();material.dispose();
});
