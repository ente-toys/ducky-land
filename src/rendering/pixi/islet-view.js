import {Container,Graphics,Matrix,RenderTexture} from 'pixi.js';
import {ISLETS,ISLET_ART,ISLET_META,ISLET_VIEWBOX} from '../../world/islets.js';
import {dot} from '../../world/sphere.js';
import {localPoint,viewFrame} from '../../world/sphere-coordinates.js';
import {svgLayerContexts} from './art/svg-context.js';
import {isletPlacement,placeIslet} from '../../world/islet-placement.js';
export {isletPlacement};

export {ISLET_VIEWBOX};
export const ATLAS_CELL=512;
const svgOf=art=>`/pixi-art/islets/${art}.svg`;
const contexts=new Map();
export function loadIsletArt(art){
 if(!contexts.has(art))contexts.set(art,fetch(svgOf(art)).then(r=>{if(!r.ok)throw Error(`${art}: ${r.status}`);return r.text();}).then(svgLayerContexts).catch(error=>{contexts.delete(art);throw error;}));
 return contexts.get(art);
}
function bakeAtlas(renderer,arts){
 const atlas=RenderTexture.create({width:4*ATLAS_CELL,height:3*ATLAS_CELL,antialias:true,autoGenerateMipmaps:true,label:'Islet globe atlas'});
 const sheet=new Container(),k=(ATLAS_CELL-4)/ISLET_VIEWBOX;
 arts.forEach(({full},n)=>{const g=new Graphics(full);g.scale.set(k);g.position.set(n%4*ATLAS_CELL+2,Math.floor(n/4)*ATLAS_CELL+2);sheet.addChild(g);});
 renderer.render({container:sheet,target:atlas,clear:true,clearColor:[0,0,0,0]});
 sheet.destroy({children:true});atlas.source.updateMipmaps();
 return atlas;
}
export async function createIsletView(app,scene,objects){
 if(!objects?.sortableChildren)throw Error('Islet props need the shared depth-sorted object layer');
 const started=performance.now();
 const arts=await Promise.all(ISLET_ART.map(loadIsletArt));
 const loadMs=Math.round(performance.now()-started);
 const atlas=bakeAtlas(app.renderer,arts);
 const layer=new Container({label:'Sea islet ground'});
 if(objects.parent===scene)scene.addChildAt(layer,scene.getChildIndex(objects));else scene.addChild(layer);
 const views=ISLETS.map(i=>{
  const root=new Container({label:`Islet ${i.id}`}),art=new Graphics({context:arts[i.artIndex].ground,label:`Islet art ${i.art}`}),k=i.width/ISLET_VIEWBOX;
  art.scale.set(k);art.position.set(-i.width/2,-i.width/2);root.addChild(art);root.visible=false;layer.addChild(root);
  const props=ISLET_META[i.art].tallPieces.map(piece=>{
   const context=arts[i.artIndex].pieces.get(piece.id);
   if(!context)throw Error(`${i.art}: missing tall piece ${piece.id}`);
   const sprite=new Container({label:`${i.id}/${piece.id}`}),visual=new Graphics(context);
   visual.scale.set(k);visual.position.set(-piece.foot[0]*k,-piece.foot[1]*k);
   sprite.addChild(visual);sprite.upright=true;sprite.visible=false;objects.addChild(sprite);
   return {piece,sprite,visual};
  });
  return {i,root,art,props,loadMs};
 });
 let from=null,placed=[];
 return {atlas,layer,views,
  transient(){return [layer,...views.flatMap(v=>v.props.map(p=>p.sprite))];},
  get placed(){return placed;},
  update(id,camera,width,height,onGlobe){
   layer.visible=!onGlobe;
   if(onGlobe){for(const v of views)for(const p of v.props)p.sprite.visible=false;return;}
   if(from!==id){
    from=id;
    placed=views.map(({i,root,props})=>{const r=isletPlacement(id,i);
     const k=i.width/ISLET_VIEWBOX;
     for(const {piece,sprite}of props){const p=placeIslet(id,i,[(piece.foot[0]-512)*k,(piece.foot[1]-512)*k]);
      sprite.position.set(p.x,p.y);sprite.zIndex=p.y;sprite.rotation=Math.atan2(r.sin,r.cos);
     }
     root.setFromMatrix(new Matrix(r.cos,r.sin,-r.sin,r.cos,r.x,r.y));return r;
    });
   }
   const view=viewFrame(id,camera),hw=width/(2*camera.zoom),hh=height/(2*camera.zoom);
   for(const v of views){const {i}=v,p=localPoint(id,i.center);
    v.root.visible=dot(view.center,i.center)>.1&&Math.abs(p.x-camera.x)<hw+i.width&&Math.abs(p.y-camera.y)<hh+i.width;
    for(const prop of v.props)prop.sprite.visible=v.root.visible;
   }
  },
  destroy(){for(const v of views)for(const p of v.props)p.sprite.destroy({children:true});layer.destroy({children:true});atlas.destroy(true);},
 };
}
