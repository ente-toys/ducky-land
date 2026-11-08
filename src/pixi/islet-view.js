import {Container,Sprite,RenderTexture,Matrix} from 'pixi.js';
import {ISLETS,ISLET_ART} from './islets.js';
import {expMap,dot} from './sphere.js';
import {localPoint,viewFrame} from './sphere-coordinates.js';
import {WORLD_GEO} from './world-map.js';

// One small static atlas for the sphere shader and the same cut-outs for sailing.
// The globe samples these exactly once, after the existing live/overview lookup.
export async function createIsletView(app,scene,acquire){
 const textures=await Promise.all(ISLET_ART.map(name=>acquire(`/pixi-art/islets/${name}.webp`)));
 const box=new Container(),cell=512;
 for(const [k,texture]of textures.entries()){
  const sprite=new Sprite(texture);sprite.position.set(k%4*cell+2,Math.floor(k/4)*cell+2);sprite.width=sprite.height=cell-4;box.addChild(sprite);
 }
 const atlas=RenderTexture.create({width:cell*4,height:cell*3,resolution:1});
 app.renderer.render({container:box,target:atlas,clear:true});box.destroy({children:true});
 const layer=new Container({label:'Decorative sea islets'});scene.addChild(layer);
 // Caller positions this above the ocean and below boats. No activity or landing
 // geometry is attached to this layer, so the eleven decorations stay unlandable.
 const sprites=ISLETS.map(i=>{const s=new Sprite(textures[i.artIndex]);s.anchor.set(.5);layer.addChild(s);return s;});
 let from=null;
 return {atlas,layer,
  update(id,camera,width,height,onGlobe){
   layer.visible=!onGlobe;if(onGlobe)return;
   if(from!==id){
    from=id;
    ISLETS.forEach((i,k)=>{const s=sprites[k],p=localPoint(id,i.center),x=localPoint(id,expMap(i,1,0,WORLD_GEO.Rw)),y=localPoint(id,expMap(i,0,1,WORLD_GEO.Rw)),scale=i.width/s.texture.width;
     // The tiny flat sprite uses this point's sphere-chart derivative, including
     // its authored roll. It is never positioned by longitude or island offsets.
     s.setFromMatrix(new Matrix((x.x-p.x)*scale,(x.y-p.y)*scale,(y.x-p.x)*scale,(y.y-p.y)*scale,p.x,p.y));
    });
   }
   const view=viewFrame(id,camera),hw=width/(2*camera.zoom),hh=height/(2*camera.zoom);
   ISLETS.forEach((i,k)=>{const p=localPoint(id,i.center);sprites[k].visible=dot(view.center,i.center)>.1&&Math.abs(p.x-camera.x)<hw+i.width&&Math.abs(p.y-camera.y)<hh+i.width;});
  },
  destroy(){layer.destroy({children:true});atlas.destroy(true);},
 };
}
