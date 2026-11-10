import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createPirateFleet,pirateClearance,pirateMotion,pirateFacing,PIRATE_COUNT,PIRATE_RADIUS,PIRATE_BOAT_GAP,PIRATE_ART,pirateBoatPoint} from '../src/pixi/pirate-fleet.js';
import {WORLD_GEO,WORLD_ISLANDS} from '../src/pixi/world-map.js';
import {ISLETS} from '../src/pixi/islets.js';
import {expMap} from '../src/pixi/sphere.js';
import {mapOf} from '../src/pixi/island-maps.js';
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]))*WORLD_GEO.Rw;
test('18 ambient ships use all three approved flat vector designs, at the requested double size',async()=>{
 const fleet=createPirateFleet();assert.equal(fleet.ships.length,PIRATE_COUNT);assert.equal(PIRATE_COUNT,18);assert.equal(new Set(fleet.ships.map(s=>s.art)).size,3);
 for(const ship of fleet.ships){assert.ok(ship.width>=600);assert.ok(pirateClearance(ship.p)>950);}
 const dir=new URL('../public/pixi-art/pirate-ships/',import.meta.url);assert.equal((await readdir(dir)).filter(n=>/\.(png|jpe?g|webp)$/i.test(n)).length,0);
 for(const art of PIRATE_ART){const text=await readFile(new URL(art+'.svg',dir),'utf8');assert.ok(text.includes('#232323'));assert.ok(text.includes('viewBox="0 0 1024 1024"'));assert.ok(!/<(?:image|linearGradient|radialGradient|filter)\b|data:image/i.test(text));assert.ok(text.length<100000);}
});
test('twenty minutes of wandering remain on open water, spread around the world with bounded continuous movement',()=>{
 const f=createPirateFleet();let min=Infinity,total=0;const start=f.ships.map(s=>[...s.p]);
 for(let k=0;k<12000;k++){
  const old=f.ships.map(s=>[...s.p]);f.update(.1);
  for(let i=0;i<f.ships.length;i++){assert.ok(distance(old[i],f.ships[i].p)<3.3,'no teleport');if(k%40===0)min=Math.min(min,pirateClearance(f.ships[i].p));}
 }
 assert.ok(min>PIRATE_RADIUS+60,'double-size hulls keep a shore margin: '+min);
 for(let k=0;k<f.ships.length;k++)total+=distance(start[k],f.ships[k].p);assert.ok(total>18000,'fleet actively wanders');
 assert.ok(new Set(start.map(p=>Math.floor((Math.atan2(p[0],p[2])+Math.PI)/(Math.PI/3)))).size>=5);
});
test('stationary player boats are avoided without modifying player state or adding collisions',()=>{
 const f=createPirateFleet(),s=f.ships[0],boat=[...s.p];let min=Infinity;
 // Start the obstacle safely ahead, then hold it still for the whole run.
 const d=800/WORLD_GEO.Rw;for(let k=0;k<3;k++)boat[k]=s.p[k]*Math.cos(d)+s.dir[k]*Math.sin(d);
 const saved=[...boat];for(let k=0;k<1800;k++){f.update(1/30,[boat]);min=Math.min(min,distance(s.p,boat));}
 assert.deepEqual(boat,saved);assert.ok(min>=PIRATE_BOAT_GAP,'boat clearance '+min);
});
test('all major-island and islet dock tips are excluded by the same read-only sea guard',()=>{
 for(const i of WORLD_ISLANDS){const m=mapOf(i.id),p=expMap(i,m.JETTY.tip.x-m.cx,m.JETTY.tip.y-m.cy,WORLD_GEO.Rw);assert.ok(pirateClearance(p)<1);}
 for(const i of ISLETS)assert.ok(pirateClearance(expMap(i,...i.jetty.tip,WORLD_GEO.Rw))<1);
});
test('mirror hysteresis ignores a brief reversal and vertical motion; bob is small and reduced motion still',()=>{
 const f={flip:1,flipAge:0};for(let i=0;i<20;i++)pirateFacing(f,-1,.016);assert.equal(f.flip,1);for(let i=0;i<60;i++)pirateFacing(f,-1,.016);assert.equal(f.flip,-1);for(let i=0;i<60;i++)pirateFacing(f,0,.016);assert.equal(f.flip,-1);
 const s=createPirateFleet().ships[0];assert.deepEqual(pirateMotion(s,1,true),{bob:0,roll:0});assert.ok(Math.abs(pirateMotion(s,1).bob)<2.4);
 const fleet=createPirateFleet();fleet.enabled=false;const p=[...fleet.ships[0].p];fleet.update(.1);assert.deepEqual(fleet.ships[0].p,p);
});

test('Pixi water motion reuses four ripple rings per ship, is non-interactive and hides cleanly',async()=>{
 const {Container,Texture}=await import('pixi.js'),{createPirateView}=await import('../src/pixi/pirate-view.js'),{pirateLocal}=await import('../src/pixi/pirate-fleet.js');
 const objects=new Container(),fleet=createPirateFleet(),view=await createPirateView(objects,fleet,{load:async()=>Texture.WHITE});
 const p=pirateLocal('home',fleet.ships[0].p),rings=view.entries.flatMap(e=>e.rings.map(r=>r.g));fleet.ships[0].velocity=20;
 for(let k=0;k<100;k++)view.update('home',{...p},k/30,1/30,false,(x,y)=>Math.hypot(x-p.x,y-p.y)<1000);
 assert.equal(view.entries[0].root.eventMode,'none');assert.ok(view.entries[0].root.visible);assert.equal(rings.length,72);assert.deepEqual(view.entries.flatMap(e=>e.rings.map(r=>r.g)),rings);assert.ok(view.entries[0].rings.some(r=>r.g.visible));
 fleet.enabled=false;view.update('home',p,4,.016,false,()=>true);assert.ok(view.entries.every(e=>!e.root.visible));view.destroy();assert.equal(objects.children.length,0);objects.destroy();
});

test('Three sprites share three textures, mirror UVs without turning the waterline and hide the back hemisphere',async()=>{
 const THREE=await import('three'),{createThreePirates}=await import('../src/pixi/three-pirates.js'),fleet=createPirateFleet({count:3}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.01,20);camera.position.z=3;camera.updateMatrixWorld(true);
 fleet.ships[0].p=[0,0,1];fleet.ships[0].dir=[-1,0,0];fleet.ships[1].p=[0,0,-1];
 const textures=[];const view=await createThreePirates(scene,fleet,{load:async()=>{const t=new THREE.Texture();textures.push(t);return t;}});
 for(let k=0;k<80;k++)view.update(new THREE.Quaternion(),camera,1,.016,false,1);
 const front=scene.getObjectByName('Pirate 0'),back=scene.getObjectByName('Pirate 1');assert.ok(front.visible);assert.equal(back.visible,false);assert.equal(front.userData.flipUniform.value,-1);assert.ok(front.scale.x>0);assert.equal(textures.length,3);
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.sprite.vertexShader};front.material.onBeforeCompile(shader);assert.ok(shader.vertexShader.includes('1.-vMapUv.x'));assert.equal(shader.uniforms.pirateFlip,front.userData.flipUniform);
 camera.aspect=1.5;camera.updateProjectionMatrix();
 view.update(new THREE.Quaternion(),camera,1,.016,true,1,()=>({x:700,y:400,width:320}),{width:1200,height:800});
 const projected=front.position.clone().project(camera);assert.ok(Math.abs((projected.x+1)*600-700)<1e-6);assert.ok(Math.abs((1-projected.y)*400-400)<1e-6,'native and sphere sprite anchors coincide during handoff');
 const depth=-front.position.clone().applyMatrix4(camera.matrixWorldInverse).z;assert.ok(Math.abs(front.scale.x/(2*depth*Math.tan(camera.fov*Math.PI/360)*camera.aspect)*1200-320)<1e-6,'native and sphere sprite sizes coincide during handoff');
 view.destroy();assert.equal(scene.children.length,0);
});
