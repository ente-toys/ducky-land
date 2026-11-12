import {Assets,Container,Sprite,Graphics} from 'pixi.js';
import {PIRATE_ART,pirateLocal,pirateMotion,pirateFacing} from './pirate-fleet.js';
import {canSail} from './islands.js';
import {ART_TEXTURE} from './art-texture.js';
export async function createPirateView(objects,fleet,{load=url=>Assets.load({src:url,data:ART_TEXTURE})}={}){
 const textures=await Promise.all(PIRATE_ART.map(n=>load('/pixi-art/pirate-ships/'+n+'.svg')));
 const entries=fleet.ships.map(ship=>{
  const root=new Container({label:'Ambient pirate '+ship.id,eventMode:'none'}),wake=new Graphics(),sprite=new Sprite(textures[ship.art]);
  sprite.anchor.set(.5,.89);sprite.width=sprite.height=ship.width;root.addChild(wake,sprite);objects.addChild(root);
  const rings=Array.from({length:4},()=>{const g=new Graphics().ellipse(0,0,1,.24).stroke({color:0xd5f3f7,width:.024,alpha:.65});g.visible=false;root.addChildAt(g,0);return{g,at:-10,p:null};});
  wake.moveTo(-12,5).quadraticCurveTo(-70,17,-110,10).moveTo(-5,11).quadraticCurveTo(-75,28,-135,18).stroke({color:0xc7f0f5,width:2.5,alpha:.6});
  return{ship,root,sprite,wake,lastX:0,lastY:0,checkAt:0,clear:true,rings,nextRipple:0,flip:{flip:1,flipAge:0}};
 });
 return{entries,update(id,camera,t,dt,reduced,visible){
  for(const e of entries){const {ship,root,sprite,wake}=e,p=pirateLocal(id,ship.p);root.visible=fleet.enabled&&visible(p.x,p.y,700);if(!root.visible)continue;
   if(t>e.checkAt){e.checkAt=t+.25;e.clear=canSail(p.x,p.y,id,330);}root.visible=e.clear;if(!e.clear)continue;
   const motion=pirateMotion(ship,fleet.time,reduced),ahead=pirateLocal(id,ship.p.map((v,k)=>v+ship.dir[k]*.001)),horizontal=(ahead.x-p.x)/(Math.hypot(ahead.x-p.x,ahead.y-p.y)||1);
   const flip=pirateFacing(e.flip,horizontal,dt);root.position.set(p.x,p.y);root.zIndex=p.y+2;
   root.rotation=-Math.atan2(camera.basis?.b??0,camera.basis?.a??1);
   sprite.scale.x=Math.abs(sprite.scale.x)*flip;sprite.y=motion.bob;sprite.rotation=motion.roll;
   wake.scale.x=flip*2;wake.scale.y=(.85+Math.sin(t*1.3+ship.phase)*.1)*2;wake.alpha=reduced?.35:.4+Math.sin(t*1.5+ship.phase)*.12;
   if(!reduced&&t>e.nextRipple&&ship.velocity>4){e.nextRipple=t+.55;const r=e.rings.reduce((a,b)=>a.at<b.at?a:b);r.p=[...ship.p];r.at=t;}
   for(const r of e.rings){const age=t-r.at;r.g.visible=!reduced&&age<2.2&&age>=0&&Boolean(r.p);if(!r.g.visible)continue;const old=pirateLocal(id,r.p),size=80+age*45;r.g.position.set(old.x-p.x,old.y-p.y);r.g.scale.set(size);r.g.alpha=(1-age/2.2)*.45;}
  }
 },destroy(){for(const e of entries)e.root.destroy({children:true});}};
}
