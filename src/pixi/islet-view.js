import {Container,Graphics,Matrix,RenderTexture} from 'pixi.js';
import {ISLETS,ISLET_ART,ISLET_VIEWBOX} from './islets.js';
import {expMap,dot} from './sphere.js';
import {localPoint,viewFrame} from './sphere-coordinates.js';
import {WORLD_GEO} from './world-map.js';
import {svgContext} from './svg-context.js';

// boss 8 Nov ("the perspective of the islets is bad", "wtf is that docking port, not even our design quality"): every islet
// is hand-drawn SVG (public/pixi-art/islets/<art>.svg) with its wooden jetty drawn in the art, in the Home centre's style.
// Close up it is drawn as real Pixi geometry, so it stays sharp at any zoom. The globe shader samples a small atlas that is
// rendered at start-up from the very same geometry, so no raster islet art ships at all.
export {ISLET_VIEWBOX};
export const ATLAS_CELL=512;   // world-view.js samples 4x3 cells of 512, each islet drawn 2px inside its cell
const svgOf=art=>`/pixi-art/islets/${art}.svg`;
const contexts=new Map();   // art -> Promise<GraphicsContext>, shared by both islets that use it
export function loadIsletArt(art){
 if(!contexts.has(art))contexts.set(art,fetch(svgOf(art)).then(r=>{if(!r.ok)throw Error(`${art}: ${r.status}`);return r.text();}).then(svgContext).catch(error=>{contexts.delete(art);throw error;}));
 return contexts.get(art);
}
// the 11 islets into one 2048x1536 atlas for the globe, straight from their vector art
function bakeAtlas(renderer,arts){
 const atlas=RenderTexture.create({width:4*ATLAS_CELL,height:3*ATLAS_CELL,antialias:true,label:'Islet globe atlas'});
 const sheet=new Container(),k=(ATLAS_CELL-4)/ISLET_VIEWBOX;
 arts.forEach((context,n)=>{const g=new Graphics(context);g.scale.set(k);g.position.set(n%4*ATLAS_CELL+2,Math.floor(n/4)*ATLAS_CELL+2);sheet.addChild(g);});
 renderer.render({container:sheet,target:atlas,clear:true,clearColor:[0,0,0,0]});
 sheet.destroy({children:true});
 return atlas;
}
export async function createIsletView(app,scene){
 const started=performance.now();
 const arts=await Promise.all(ISLET_ART.map(loadIsletArt));
 const loadMs=Math.round(performance.now()-started);   // QA readback: fetch + parse of all eleven
 const atlas=bakeAtlas(app.renderer,arts);
 const layer=new Container({label:'Sea islets'});scene.addChild(layer);
 // Caller positions this above the ocean and below boats.
 const views=ISLETS.map(i=>{
  const root=new Container({label:`Islet ${i.id}`}),art=new Graphics({context:arts[i.artIndex],label:`Islet art ${i.art}`}),k=i.width/ISLET_VIEWBOX;
  art.scale.set(k);art.position.set(-i.width/2,-i.width/2);root.addChild(art);root.visible=false;layer.addChild(root);
  return {i,root,art,loadMs};
 });
 let from=null;
 return {atlas,layer,views,
  update(id,camera,width,height,onGlobe){
   layer.visible=!onGlobe;if(onGlobe)return;
   if(from!==id){
    from=id;
    for(const {i,root}of views){const p=localPoint(id,i.center),x=localPoint(id,expMap(i,1,0,WORLD_GEO.Rw)),y=localPoint(id,expMap(i,0,1,WORLD_GEO.Rw));
     // The small flat islet uses this point's sphere-chart derivative. islets.js rolls its frame so that, in its home
     // island's view, this comes out upright: the art is never turned against our camera.
     root.setFromMatrix(new Matrix(x.x-p.x,x.y-p.y,y.x-p.x,y.y-p.y,p.x,p.y));
    }
   }
   const view=viewFrame(id,camera),hw=width/(2*camera.zoom),hh=height/(2*camera.zoom);
   for(const v of views){const {i}=v,p=localPoint(id,i.center);
    v.root.visible=dot(view.center,i.center)>.1&&Math.abs(p.x-camera.x)<hw+i.width&&Math.abs(p.y-camera.y)<hh+i.width;
   }
  },
  destroy(){layer.destroy({children:true});atlas.destroy(true);},
 };
}
