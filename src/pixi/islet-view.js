import {Assets,Container,Graphics,Matrix,Rectangle,Sprite,Texture} from 'pixi.js';
import {ISLETS,ISLET_ART} from './islets.js';
import {expMap,dot} from './sphere.js';
import {localPoint,viewFrame} from './sphere-coordinates.js';
import {WORLD_GEO} from './world-map.js';

// boss 8 Nov ("why are these islets pixelated, not pixel perfect like the homeland centre"): close up, every islet is its
// vector art (public/pixi-art/islets/<art>.svg, scripts/islets/vectorize.py) drawn as real Pixi geometry, so it stays sharp
// at any zoom. The globe shader samples one small raster atlas made from the same SVGs (atlas.webp, scripts/islets/atlas.mjs);
// until an islet's vector art has loaded, its cell of that atlas stands in. Each islet also carries its little jetty.
export const ATLAS_SRC='/pixi-art/islets/atlas.webp';
export const ISLET_VIEWBOX=1024;
const CELL=512;
const svgOf=art=>`/pixi-art/islets/${art}.svg`;
const contexts=new Map();   // art -> Promise<GraphicsContext>, shared by both islets that use it
function loadArt(art){
 if(!contexts.has(art))contexts.set(art,Assets.load({src:svgOf(art),data:{parseAsGraphicsContext:true}}).catch(error=>{contexts.delete(art);throw error;}));
 return contexts.get(art);
}
// the jetty, in the islet's own tangent frame (x east, y south, world units)
function drawJetty(j){
 const g=new Graphics({label:'Islet jetty'}),[fx,fy]=j.foot,[tx,ty]=j.tip,len=Math.hypot(tx-fx,ty-fy),w=j.width;
 g.position.set(fx,fy);g.rotation=Math.atan2(ty-fy,tx-fx);
 for(const side of [-1,1])g.roundRect(len-14,side*(w/2-4)-9,18,18,6).fill(0x6b4423).stroke({color:0x3b2412,width:4});
 g.roundRect(0,-w/2,len,w,8).fill(0xc08a52).stroke({color:0x4a2e17,width:5});
 for(let x=20;x<len-6;x+=22)g.moveTo(x,-w/2+5).lineTo(x,w/2-5);
 g.stroke({color:0x8a5a2e,width:3});
 for(const side of [-1,1])g.circle(len-6,side*(w/2-4),9).fill(0x7a4e28).stroke({color:0x3b2412,width:4});
 return g;
}
export async function createIsletView(app,scene,acquire){
 const atlas=await acquire(ATLAS_SRC);
 const cells=ISLET_ART.map((_,k)=>new Texture({source:atlas.source,frame:new Rectangle(k%4*CELL+2,Math.floor(k/4)*CELL+2,CELL-4,CELL-4)}));
 const layer=new Container({label:'Sea islets'});scene.addChild(layer);
 // Caller positions this above the ocean and below boats.
 const views=ISLETS.map(i=>{
  const root=new Container({label:`Islet ${i.id}`}),stand=new Sprite(cells[i.artIndex]);
  stand.anchor.set(.5);stand.width=stand.height=i.width;root.addChild(stand);
  const jetty=drawJetty(i.jetty);root.addChild(jetty);layer.addChild(root);
  return {i,root,stand,jetty,art:null};
 });
 const sharpen=v=>{
  if(v.art)return;
  v.art='loading';const started=performance.now();
  loadArt(v.i.art).then(context=>{
   v.loadMs=Math.round(performance.now()-started);   // QA readback: fetch + parse of the vector art
   if(v.root.destroyed)return;
   const art=new Graphics(context),k=v.i.width/ISLET_VIEWBOX;
   art.scale.set(k);art.position.set(-v.i.width/2,-v.i.width/2);
   v.root.addChildAt(art,0);v.stand.visible=false;v.art=art;
  }).catch(()=>{v.art=null;});
 };
 let from=null;
 return {atlas,layer,views,
  update(id,camera,width,height,onGlobe){
   layer.visible=!onGlobe;if(onGlobe)return;
   if(from!==id){
    from=id;
    for(const {i,root}of views){const p=localPoint(id,i.center),x=localPoint(id,expMap(i,1,0,WORLD_GEO.Rw)),y=localPoint(id,expMap(i,0,1,WORLD_GEO.Rw));
     // The small flat islet uses this point's sphere-chart derivative, including its authored roll. It is never
     // positioned by longitude or island offsets.
     root.setFromMatrix(new Matrix(x.x-p.x,x.y-p.y,y.x-p.x,y.y-p.y,p.x,p.y));
    }
   }
   const view=viewFrame(id,camera),hw=width/(2*camera.zoom),hh=height/(2*camera.zoom);
   for(const v of views){const {i}=v,p=localPoint(id,i.center);
    v.root.visible=dot(view.center,i.center)>.1&&Math.abs(p.x-camera.x)<hw+i.width&&Math.abs(p.y-camera.y)<hh+i.width;
    if(v.root.visible)sharpen(v);
   }
  },
  destroy(){layer.destroy({children:true});for(const t of cells)t.destroy(false);},
 };
}
