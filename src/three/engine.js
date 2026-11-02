import * as THREE from 'three';
import {buildWorld,world,toScene,toWorld,heightAt} from './world.js';
import {createSimulation} from './simulation.js';
import {createDuck} from './models/duck.js';
import {IslandCamera,installInput} from './camera.js';
import {createEnvironment} from './environment.js';
import {createAudio} from './audio.js';
import {disposeObject} from './registry.js';
import {DynamicInstances} from './instances.js';
import {disposeShared} from './models/primitives.js';
let activeEngines=0;
export class IslandEngine {
 constructor({onError=()=>{},rendererFactory=options=>new THREE.WebGLRenderer(options)}={}){this.onError=onError;this.rendererFactory=rendererFactory;this.disposed=false;this.ready=false;this.last=0;this.accumulator=0;this.frame=0;this.listeners=[];this.actors=[];this.audio=createAudio();this.reduced=matchMedia('(prefers-reduced-motion: reduce)');this.stats={frames:0,sum:0,slow:0,quality:1,cpu:0,samples:[]};activeEngines++;}
 async mount(container){this.container=container;try{
 this.renderer=this.rendererFactory({antialias:true,powerPreference:'high-performance'});const renderer=this.renderer;renderer.setClearColor(0x7fcde7);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));container.append(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D Ducky Land island. Scroll or pinch to zoom. Drag to pan, right-drag to orbit. WASD walks, Q quacks, E dances, F follows, 0 resets.');
 this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0x7fcde7,90,180);this.camera=new THREE.OrthographicCamera(-30,30,25,-25,.1,240);this.cam=new IslandCamera(this.camera,renderer.domElement);this.scene.add(new THREE.HemisphereLight(0xfff6d9,0x578564,1.2));
 const sun=new THREE.DirectionalLight(0xfff2dc,1.6);sun.position.set(-25,45,22);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-34,right:34,top:29,bottom:-29,near:1,far:100});sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;this.scene.add(sun);this.sun=sun;
 this.sim=createSimulation(world);this.resize();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
 this.world=await buildWorld(this.scene);if(this.disposed){this.cleanup();return;}
 this.env=createEnvironment(this.scene);
 for(const d of this.sim.ducks){const actor=createDuck({outfit:d.outfit,seed:d.id});actor.root.userData.duckId=d.id;const bounds=new THREE.Box3().setFromObject(actor.root);const h=bounds.max.y-bounds.min.y;actor.root.scale.multiplyScalar(1.85/h);this.scene.add(actor.root);this.actors.push(actor);}
 this.instances=new DynamicInstances(this.scene,[...this.world.dynamic,...this.actors.map(a=>a.root)]);
 this.marker=new THREE.Mesh(new THREE.RingGeometry(.2,.24,28),new THREE.MeshBasicMaterial({color:0xfffbde,transparent:true,depthWrite:false,side:THREE.DoubleSide}));this.marker.rotation.x=-Math.PI/2;this.marker.visible=false;this.scene.add(this.marker);
 this.input=installInput(renderer.domElement,this.cam,{tap:(x,y)=>this.tap(x,y),unlock:()=>this.audio.unlock(),emote:a=>this.triggerEmote(a),mute:()=>this.audio.toggle(),stop:()=>this.sim.stopInput()});
 const on=(target,type,fn)=>{target.addEventListener(type,fn);this.listeners.push(()=>target.removeEventListener(type,fn));};
 on(document,'visibilitychange',()=>{this.last=0;this.accumulator=0;if(document.hidden)this.audio.suspend();else this.audio.resume();});
 on(renderer.domElement,'webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(this.frame);this.onError(new Error('The 3D graphics context was interrupted. Reload to restore the island.'));});
 on(renderer.domElement,'webglcontextrestored',()=>{this.onError(null);this.last=0;this.frame=requestAnimationFrame(t=>this.tick(t));});
 const initialZone=new URLSearchParams(location.search).get('zone');if(initialZone)this.focusZone(initialZone);renderer.domElement.dataset.ready='true';renderer.domElement.dataset.ducks='29';this.ready=true;this.frame=requestAnimationFrame(t=>this.tick(t));
 }catch(error){if(!this.disposed){console.error(error);this.onError(error);}this.cleanup();}}
 resize(){if(!this.renderer||!this.container||this.disposed)return;const {width,height}=this.container.getBoundingClientRect();this.renderer.setSize(Math.max(width,1),Math.max(height,1));this.cam.resize(Math.max(width,1),Math.max(height,1));}
 tap(x,y){const ray=this.cam.ray(x,y);ray.layers.enable(1);const hits=ray.intersectObjects(this.actors.map(a=>a.root),true);if(hits.length){let hit=hits[0].object;while(hit&&hit.userData.duckId===undefined)hit=hit.parent;if(hit){const d=this.sim.ducks[hit.userData.duckId];if(d.player){const now=performance.now();this.triggerEmote(now-(this.lastTap||0)<450?3:2);this.lastTap=now;}else{this.sim.emote(2,d);d.turn=Math.atan2(this.sim.player.x-d.x,this.sim.player.y-d.y);this.triggerEmote(6);}return;}}
 const ground=ray.intersectObject(this.world.terrain,true)[0]?.point;if(ground)this.setDestination(toWorld(ground));}
 setDestination({x,y}){const p=this.sim.destination(x,y);if(p){this.marker.position.copy(toScene(...p));this.marker.position.y=heightAt(...p)+.12;this.marker.visible=true;this.markerAt=this.sim.time;}return p;}
 triggerEmote(action){if(!this.sim)return;this.sim.emote(action);this.audio.unlock().then(()=>this.audio.play(action===2?'quack':'pop',action===2?.15:.07));}
 focusZone(name){const zone=world.zones[name];if(!zone)return false;this.input.following=false;this.cam.target.copy(toScene(zone.x,zone.y));this.cam.zoom=3.3;this.cam.yaw=0;this.cam.polar=.65;this.cam.update(0,true);return true;}
 fit(){if(this.input)this.input.following=false;this.cam.fit();} follow(){if(this.input)this.input.following=true;this.cam.target.copy(toScene(this.sim.player.x,this.sim.player.y));this.cam.zoom=Math.max(3,this.cam.zoom);}
 tick(now){if(this.disposed)return;const frameStarted=performance.now();this.frame=requestAnimationFrame(t=>this.tick(t));if(document.hidden){this.last=0;return;}const dt=Math.min(.1,this.last?(now-this.last)/1000:0);this.last=now;this.accumulator+=dt;while(this.accumulator>=1/60){this.sim.step(1/60,this.input.movement);this.accumulator-=1/60;}const alpha=this.accumulator*60;
 if(this.input.following){const p=toScene(this.sim.player.x,this.sim.player.y);p.y=.5;this.cam.target.copy(p);}this.cam.update(dt,this.reduced.matches);
 for(let i=0;i<this.actors.length;i++){const d=this.sim.ducks[i],a=this.actors[i],x=d.previousX+(d.x-d.previousX)*alpha,y=d.previousY+(d.y-d.previousY)*alpha;a.root.position.copy(toScene(x,y));a.root.position.y=heightAt(x,y)+.04;a.root.rotation.y=d.turn;const projected=a.root.position.clone().project(this.camera),inView=Math.abs(projected.x)<1.2&&Math.abs(projected.y)<1.2;a.root.visible=inView;
 a.animationTime=(a.animationTime||0)+dt;if(inView&&(this.cam.currentZoom>1.5||a.animationTime>=1/30||d.player)){a.update(a.animationTime,{action:d.action,speed:d.travel/100,turn:d.turn,time:this.sim.time,reducedMotion:this.reduced.matches,emoteVersion:d.emoteVersion});a.animationTime=0;}
 if(!d.player&&d.action===2&&a.lastEmoteVersion!==d.emoteVersion&&Math.hypot(d.x-this.sim.player.x,d.y-this.sim.player.y)<650)this.audio.play('quack',.035);a.lastEmoteVersion=d.emoteVersion;
 if(d.player&&d.action===1&&this.sim.time-(this.lastStep||0)>.28){this.audio.play('step',.035);this.lastStep=this.sim.time;}}
 this.world.update(this.sim.time,this.reduced.matches);this.env.update(this.sim.time,this.reduced.matches);
 if(this.marker.visible){const age=this.sim.time-this.markerAt;this.marker.material.opacity=Math.max(0,1-age/1.5);this.marker.scale.setScalar(1+age*.5);if(age>1.5)this.marker.visible=false;}
 this.instances.update();this.renderer.render(this.scene,this.camera);this.renderer.domElement.dataset.rendered='true';this.stats.frames++;this.stats.sum+=dt;this.stats.cpu+=performance.now()-frameStarted;if(now-(this.lastDiagnostic||0)>150){this.lastDiagnostic=now;Object.assign(this.renderer.domElement.dataset,{playerX:this.sim.player.x.toFixed(2),playerY:this.sim.player.y.toFixed(2),action:String(this.sim.player.action),zoom:this.cam.currentZoom.toFixed(2)});}if(dt>0)this.stats.samples.push(dt*1000);
 if(this.stats.sum>2){const fps=this.stats.frames/this.stats.sum;this.renderer.domElement.dataset.fps=fps.toFixed(1);this.renderer.domElement.dataset.drawCalls=String(this.renderer.info.render.calls);this.renderer.domElement.dataset.triangles=String(this.renderer.info.render.triangles);this.stats.samples.sort((a,b)=>a-b);this.renderer.domElement.dataset.frameMs=(1000/fps).toFixed(2);this.renderer.domElement.dataset.p95Ms=(this.stats.samples[Math.floor(this.stats.samples.length*.95)]||0).toFixed(2);this.renderer.domElement.dataset.cpuMs=(this.stats.cpu/this.stats.frames).toFixed(2);this.renderer.domElement.dataset.geometries=String(this.renderer.info.memory.geometries);this.renderer.domElement.dataset.textures=String(this.renderer.info.memory.textures);this.stats.frames=0;this.stats.sum=0;this.stats.cpu=0;this.stats.samples=[];if(fps<35)this.stats.slow++;else this.stats.slow=0;if(this.stats.slow>=2&&this.stats.quality>0){this.stats.quality=0;this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));this.renderer.shadowMap.enabled=false;this.env.setQuality(false);this.world.decorations.count=Math.min(this.world.decorations.count,120);this.resize();}}
 }
 cleanup(){if(this.cleaned)return;this.cleaned=true;cancelAnimationFrame(this.frame);this.input?.dispose();this.resizeObserver?.disconnect();this.listeners.forEach(f=>f());this.audio.dispose();if(this.scene)disposeObject(this.scene);this.instances?.dispose();this.actors.forEach(a=>a.dispose());this.renderer?.dispose();this.renderer?.forceContextLoss();this.renderer?.domElement.remove();activeEngines--;if(activeEngines===0)disposeShared();}
 dispose(){this.disposed=true;if(this.ready||!this.container)this.cleanup();}
}
