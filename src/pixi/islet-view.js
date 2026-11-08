import {Container,Sprite,RenderTexture,Matrix} from 'pixi.js';
import {ISLETS,ISLET_ART} from './islets.js';
import {expMap,dot} from './sphere.js';
import {localPoint,viewFrame} from './sphere-coordinates.js';
import {WORLD_GEO} from './world-map.js';
import {polar} from './rigid.js';

// The islet's rigid placement in island `id`'s flat chart: centre where the sphere puts it, turned by the chart's
// rotation there (authored roll included), true size. Never the chart's derivative itself, which shears (boss 8 Nov).
export function isletPlacement(id,islet){
 const p=localPoint(id,islet.center),h=4,P=(x,y)=>localPoint(id,expMap(islet,x,y,WORLD_GEO.Rw));
 const xp=P(h,0),xm=P(-h,0),yp=P(0,h),ym=P(0,-h);
 const q=polar((xp.x-xm.x)/(2*h),(xp.y-xm.y)/(2*h),(yp.x-ym.x)/(2*h),(yp.y-ym.y)/(2*h));
 return {x:p.x,y:p.y,cos:q.cos,sin:q.sin};
}
// One small static atlas for the sphere shader and the same cut-outs for sailing.
// The globe samples these exactly once, after the existing live/overview lookup.
export async function createIsletView(app,scene,acquire){
 const textures=await Promise.all(ISLET_ART.map(name=>acquire(`/pixi-art/islets/${name}.webp`)));
 const box=new Container(),cell=512;
 for(const [k,texture]of textures.entries()){
  const sprite=new Sprite(texture);sprite.position.set(k%4*cell+2,Math.floor(k/4)*cell+2);sprite.width=sprite.height=cell-4;box.addChild(sprite);
 }
 // Mipmapped: on the globe an islet is a few dozen pixels, and a plain minified lookup shimmers into blocks.
 const atlas=RenderTexture.create({width:cell*4,height:cell*3,resolution:1,autoGenerateMipmaps:true,scaleMode:'linear'});
 app.renderer.render({container:box,target:atlas,clear:true});box.destroy({children:true});atlas.source.updateMipmaps();
 const layer=new Container({label:'Decorative sea islets'});scene.addChild(layer);
 // Caller positions this above the ocean and below boats. No activity or landing
 // geometry is attached to this layer, so the eleven decorations stay unlandable.
 const sprites=ISLETS.map(i=>{const s=new Sprite(textures[i.artIndex]);s.anchor.set(.5);layer.addChild(s);return s;});
 let from=null,placed=[];
 return {atlas,layer,
  get placed(){return placed;},
  update(id,camera,width,height,onGlobe){
   layer.visible=!onGlobe;if(onGlobe)return;
   if(from!==id){
    from=id;
    placed=ISLETS.map((i,k)=>{const s=sprites[k],r=isletPlacement(id,i),scale=i.width/s.texture.width;
     s.setFromMatrix(new Matrix(r.cos*scale,r.sin*scale,-r.sin*scale,r.cos*scale,r.x,r.y));
     return r;
    });
   }
   const view=viewFrame(id,camera),hw=width/(2*camera.zoom),hh=height/(2*camera.zoom);
   ISLETS.forEach((i,k)=>{const p=placed[k];sprites[k].visible=dot(view.center,i.center)>.1&&Math.abs(p.x-camera.x)<hw+i.width&&Math.abs(p.y-camera.y)<hh+i.width;});
  },
  destroy(){layer.destroy({children:true});atlas.destroy(true);},
 };
}
