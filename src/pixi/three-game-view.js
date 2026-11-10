import {pirateLocal} from './pirate-fleet.js';
import {createThreeWorld} from './three-world-view.js';
import {retainDetailArt} from './three-game-budget.js';
import {detailBlend,directDetail,detailSize,detailCamera,detailScreen} from './three-detail-view.js';
import {mapOf,artOf} from './island-maps.js';
import {WORLD_ISLANDS,WORLD_GEO} from './world-map.js';
import {flatRigid} from './rigid.js';
import {mapPoint} from './sphere-coordinates.js';
import {TILT} from './camera.js';
import {cameraMatrix as atlasCameraMatrix} from './sphere-camera.js';
import {surfacePoint,surfaceCoordinates} from './three-globe-math.js';

// One live game/room supplies the detail texture. The globe never creates a
// second player, connection or simulation, and the same camera handles every zoom.
export async function createThreeGameView(game,host){
  let disposed=false,world=null,last=0,view=null,following=true,shown=game.artShown,direct=false,blend=0,flatFrames=0;
  const flatOffset={x:0,y:0};
  const nativeTick=game.tick.bind(game),nativeRender=game.app.render.bind(game.app),nativeResize=game.resize.bind(game),nativeInterior=game.onInteriorChange;
  const layer=document.createElement('div');layer.className='pixi-earth-view';Object.assign(layer.style,{position:'absolute',inset:0,zIndex:'1',background:'#000'});host.append(layer);
  const home=document.createElement('button');home.className='pixi-earth-find';home.textContent='Your duck';home.type='button';Object.assign(home.style,{position:'absolute',bottom:'20px',left:'50%',transform:'translateX(-50%)',zIndex:3});layer.append(home);
  const objects=()=>[...game.rigs.filter((r,i)=>game.localDucks[i]?.player).map(r=>r.root),...[...game.liveRigs.values()].map(e=>e.rig?.root),...(game.travelView?.transient()??[])].filter(Boolean);
  const originalIsletUpdate=game.isletView?.update.bind(game.isletView);
  if(originalIsletUpdate)game.isletView.update=(id,...args)=>originalIsletUpdate(view?.id??id,...args);
  game.app.render=()=>{
    if(game.interior?.active)return nativeRender();
    const hidden=[blend===0?game.ocean:null,game.archipelago?.root].filter(Boolean).map(o=>[o,o.visible]);hidden.forEach(([o])=>o.visible=false);
    const oceanAlpha=game.ocean.alpha,backgroundAlpha=game.app.renderer.background.alpha;game.ocean.alpha=blend;game.app.renderer.background.alpha=blend;
    const moved=[];
    if(view&&view.id!==game.islandId)for(const o of objects()){
      const saved={o,x:o.x,y:o.y,z:o.zIndex,visible:o.visible};moved.push(saved);
      const p=mapPoint(game.islandId,view.id,o);o.position.set(p.x,p.y);o.zIndex=saved.z+p.y-saved.y;
      o.visible=Math.abs(p.x-game.camera.x)<game.width/game.camera.zoom&&Math.abs(p.y-game.camera.y)<game.height/game.camera.zoom;
    }
    try{nativeRender();}finally{game.ocean.alpha=oceanAlpha;game.app.renderer.background.alpha=backgroundAlpha;for(const [o,v]of hidden)o.visible=v;for(const s of moved){s.o.position.set(s.x,s.y);s.o.zIndex=s.z;s.o.visible=s.visible;}}
  };
  game.duckLabelPosition=pose=>{
    const sphere=world?.project(game.islandId,pose.x,pose.y-165)??{x:-1000,y:-1000};
    if(!view||blend===0)return sphere;
    const p=mapPoint(game.islandId,view.id,{x:pose.x,y:pose.y-165}),flat=detailScreen(game.camera,p.x,p.y,game.width,game.height,host.clientWidth,host.clientHeight,TILT);
    return {x:sphere.x*(1-blend)+flat.x*blend,y:sphere.y*(1-blend)+flat.y*blend};
  };
  game.placeLabel=(label,x,y)=>{label.hidden=!view||view.altitude>.5||x<0||y<0||x>host.clientWidth||y>host.clientHeight;if(!label.hidden)label.style.translate=`${x}px ${y}px`;};
  game.liveCopies=()=>{retainDetailArt(game,game.externalDetailVisible===false?null:game.artShown);return[];};game.buildCopies=()=>{};
  game.resize=()=>{
    if(game.interior?.active)return nativeResize();
    // Keep globe uploads bounded; native close detail renders at the host's DPR.
    const size=direct?{width:Math.max(1,host.clientWidth),height:Math.max(1,host.clientHeight)}:detailSize(host.clientWidth,host.clientHeight,devicePixelRatio||1);
    const resolution=direct?Math.min(globalThis.devicePixelRatio||1,2):1;
    if(game.width!==size.width||game.height!==size.height||game.app.renderer.resolution!==resolution){
      game.width=size.width;game.height=size.height;game.app.renderer.resolution=resolution;game.app.renderer.resize(game.width,game.height);
    }
    game.canvas.style.width='100%';game.canvas.style.height='100%';
  };
  const find=()=>{const p=game.room?.view()??game.player,m=mapOf(game.islandId);following=true;flatOffset.x=flatOffset.y=0;world?.centreOn(game.islandId,p?.x??m.cx,(p?.y??m.cy)-90,.12,true);};
  game.listen(window,'keydown',e=>{if(e.key.toLowerCase()==='f'&&!/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)&&!e.target?.isContentEditable)find();});
  game.flyHome=find;game.fit=()=>{following=false;world?.world();};home.onclick=find;
  function interior(active){
    nativeInterior(active);game.canvas.setAttribute('aria-hidden',active?'false':'true');game.canvas.tabIndex=active?0:-1;direct=false;flatFrames=0;world?.setPresentation(0,false);
    layer.style.display=active?'none':'';game.canvas.style.visibility=active?'':'hidden';world?.setActive(!active);
    if(active){game.externalDetailVisible=true;game.externalCamera=null;game.tick=nativeTick;nativeResize();game.raf=requestAnimationFrame(nativeTick);}
    else{cancelAnimationFrame(game.raf);game.tick=()=>{};game.resize();last=0;find();}
  }
  game.onInteriorChange=interior;
  function update(state){
    if(disposed||!world||!game.ready||game.interior?.active)return;
    view=state;game.externalPirateIsland=state.id;game.resize();const now=performance.now();if(now-last<1000/(state.altitude>.6?20:60)-.5)return;last=now;
    const detailVisible=state.altitude<1.8;
    game.externalDetailVisible=detailVisible;
    const id=state.id,map=mapOf(id),mapId=artOf(id);
    retainDetailArt(game,detailVisible?mapId:null);
    if(!detailVisible){
      direct=false;blend=0;flatFrames=0;world.setPresentation(0,false);game.canvas.style.visibility='hidden';flatOffset.x=flatOffset.y=0;
      nativeTick(now);cancelAnimationFrame(game.raf);world.clearLiveCanvas();
      home.hidden=!game.player;if(game.nameLayer)game.nameLayer.style.opacity='0';
      return;
    }
    if(shown!==mapId||game.artShown!==mapId){world.clearLiveCanvas();shown=mapId;game.wantedArts=new Set(['home',mapId]);game.artShown=mapId;game.showArt(mapId);game.applyMapAmbience(mapId);}
    game.ensureArt(mapId);
    blend=detailBlend(state.altitude);
    if(following)flatOffset.x=flatOffset.y=0;
    const camera=detailCamera(WORLD_ISLANDS.find(i=>i.id===id),map,{...state,radius:WORLD_GEO.Rw},game.width,game.height,TILT,flatOffset),zoom=camera.zoom;
    game.minZoom=.00001;game.zoomAnchor=null;game.zoomMotion.velocity=0;game.spin=null;game.globeAim=null;game.fly=null;game.follow=false;game.fitMode=false;game.landingView=null;game.globeT=0;
    game.externalCamera=camera;
    Object.assign(game.camera,game.externalCamera);delete game.camera.basis;Object.assign(game.target,game.camera);
    nativeTick(now);cancelAnimationFrame(game.raf);
    if(game.interior?.active)return;
    const p=game.room?.view()??game.player;
    const moving=game.keys.size>0||game.touchInput.x||game.touchInput.y;
    if(moving)following=true;
    if(following&&p&&state.altitude<.55)world.centreOn(game.islandId,p.x,p.y-90);
    const ready=game.artReady(mapId);
    flatFrames=blend===1&&ready?flatFrames+1:0;
    const nextDirect=directDetail(state.altitude,direct,ready)&&(direct||flatFrames>=2);
    direct=nextDirect;world.setPresentation(blend,direct);
    game.canvas.style.visibility=blend>0?'visible':'hidden';
    if(!direct&&state.altitude<1.8&&ready)world.setLiveCanvas(id,game.canvas,flatRigid(id,id),atlasCameraMatrix(game.camera,game.width,game.height,TILT),game.width,game.height,{x:game.camera.x-map.cx,y:game.camera.y-map.cy,width:game.width/zoom,height:game.height/zoom});
    else if(state.altitude>=1.8)world.clearLiveCanvas();
    home.hidden=!p||state.altitude<.5;
    if(game.nameLayer)game.nameLayer.style.opacity=state.altitude>.5?'0':'';
    const c=layer.querySelector('canvas[data-renderer="threejs"]');if(c){c.dataset.playerIsland=game.islandId;c.dataset.livePlayerCount=String(game.liveRigs.size);c.dataset.gameIntegrated='true';c.dataset.captureSize=game.width+'x'+game.height;}
  }
  function pickDetail(screen){
    if(!view||blend===0||!world)return null;
    const map=mapOf(view.id),w=host.clientWidth,h=host.clientHeight;
    let x=game.camera.x+(screen.x-w/2)*game.width/w/game.camera.zoom,y=game.camera.y+(screen.y-h/2)*game.height/h/(game.camera.zoom*TILT);
    const project=(x,y)=>{const flat=detailScreen(game.camera,x,y,game.width,game.height,w,h,TILT);if(blend===1)return flat;const p=world.project(view.id,x,y)??flat;return{x:p.x*(1-blend)+flat.x*blend,y:p.y*(1-blend)+flat.y*blend};};
    for(let k=0;k<4&&blend<1;k++){
      const p=project(x,y),a=project(x+1,y),b=project(x,y+1),dx=screen.x-p.x,dy=screen.y-p.y,aa=a.x-p.x,bb=a.y-p.y,cc=b.x-p.x,dd=b.y-p.y,det=aa*dd-bb*cc;
      if(Math.abs(det)<1e-12)break;x+=(dd*dx-cc*dy)/det;y+=(-bb*dx+aa*dy)/det;
    }
    return{id:view.id,x:x-map.cx,y:y-map.cy};
  }
  try{
    world=await createThreeWorld(layer,{pirateFleet:game.pirateFleet,pirateProjection:ship=>{if(!view||blend<=0)return null;const p=pirateLocal(view.id,ship.p),screen=detailScreen(game.camera,p.x,p.y,game.width,game.height,host.clientWidth,host.clientHeight,TILT);return{...screen,width:ship.width*game.camera.zoom*host.clientWidth/game.width};},onFrame:update,onInteract:()=>{following=false;},surfaceAtPointer:screen=>pickDetail(screen),onTap:({id,x,y,screen})=>{
      if(!game.player)return;
      const frame=WORLD_ISLANDS.find(i=>i.id===id),own=WORLD_ISLANDS.find(i=>i.id===game.islandId);
      const visible=blend>0&&screen?pickDetail(screen):null;
      const point=visible?surfacePoint(WORLD_ISLANDS.find(i=>i.id===visible.id),visible.x,visible.y,WORLD_GEO.Rw):surfacePoint(frame,x,y,WORLD_GEO.Rw);
      const p=surfaceCoordinates(own,point,WORLD_GEO.Rw),m=mapOf(game.islandId);
      const target={x:p.x+m.cx,y:p.y+m.cy};
      const pixel={x:game.width/2+(target.x-game.camera.x)*game.camera.zoom,y:game.height/2+(target.y-game.camera.y)*game.camera.zoom*TILT};
      game.tap(pixel);following=id===game.islandId;
    }});
    if(import.meta.env?.DEV)game.inspectPirate=(x,y)=>{following=false;world.centreOn('home',x,y,.12,true);};
    if(disposed){world.destroy();return;}
    cancelAnimationFrame(game.raf);game.tick=()=>{};game.resize();game.canvas.style.visibility='hidden';game.app.renderer.background.alpha=0;
    game.canvas.dataset.earthView='active';game.canvas.setAttribute('aria-hidden','true');game.canvas.tabIndex=-1;find();
  }catch(error){layer.remove();game.app.render=nativeRender;game.tick=nativeTick;game.resize=nativeResize;game.onInteriorChange=nativeInterior;throw error;}
  return {destroy(){disposed=true;world?.destroy();layer.remove();}};
}
