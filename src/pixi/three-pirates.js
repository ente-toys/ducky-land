import {Vector3} from './globe-math.js';
import * as Globe from './globe-mesh.js';
import {PIRATE_ART,pirateMotion,pirateFacing} from './pirate-fleet.js';
import {WORLD_GEO} from './world-map.js';
import {visiblePoint} from './three-globe-math.js';
export async function createThreePirates(scene,fleet,{load=url=>new Globe.TextureLoader().loadAsync(url)}={}){
 const textures=await Promise.all(PIRATE_ART.map(n=>load('/pixi-art/pirate-ships/'+n+'.svg')));
 textures.forEach(t=>{t.colorSpace=Globe.SRGBColorSpace;});
 const entries=fleet.ships.map(ship=>{const material=new Globe.SpriteMaterial({map:textures[ship.art],transparent:true,depthTest:false,depthWrite:false}),sprite=new Globe.Sprite(material);const flipUniform={value:1};material.onBeforeCompile=shader=>{shader.uniforms.pirateFlip=flipUniform;shader.vertexShader='uniform float pirateFlip;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x=pirateFlip<0.?1.-vMapUv.x:vMapUv.x;\n#endif');};sprite.userData.flipUniform=flipUniform;sprite.center.set(.5,.11);sprite.name='Pirate '+ship.id;scene.add(sprite);return{ship,sprite,flip:{flip:1,flipAge:0}};});
 const ahead=new Vector3(),delta=new Vector3();
 return{update(q,camera,t,dt,reduced,opacity,project=()=>null,viewport=null){let shown=0;
  for(const {ship,sprite,flip}of entries){sprite.position.set(...ship.p).multiplyScalar(1.002).applyQuaternion(q);
   sprite.visible=fleet.enabled&&opacity>.001&&visiblePoint(sprite.position,camera.position)&&sprite.position.dot(delta.copy(camera.position).sub(sprite.position))>.12;if(!sprite.visible)continue;shown++;
   ahead.set(...ship.dir).applyQuaternion(q).transformDirection(camera.matrixWorldInverse);
   const sign=pirateFacing(flip,ahead.x/Math.hypot(ahead.x,ahead.y),dt),motion=pirateMotion(ship,fleet.time,reduced);let size=ship.width/WORLD_GEO.Rw;
   const screen=project(ship);if(screen&&viewport){const depth=sprite.position.clone().project(camera).z;sprite.position.set(screen.x/viewport.width*2-1,1-screen.y/viewport.height*2,depth).unproject(camera);const viewDepth=-sprite.position.clone().applyMatrix4(camera.matrixWorldInverse).z;size=screen.width*2*viewDepth*Math.tan(camera.fov*Math.PI/360)/viewport.height;}
   sprite.scale.set(size,size,1);sprite.material.rotation=motion.roll;sprite.material.opacity=opacity;sprite.renderOrder=210-sprite.position.y*1000;
   // Texture UV mirroring keeps the flat waterline horizontal.
   sprite.material.map=textures[ship.art];sprite.userData.flip=sign;
   sprite.userData.flipUniform.value=sign;sprite.scale.x=size;sprite.position.y+=motion.bob*size/ship.width;
  }return shown;
 },destroy(){for(const e of entries){e.sprite.removeFromParent();e.sprite.material.dispose();}textures.forEach(t=>t.dispose());}};
}
