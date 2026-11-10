import {createThreeWorld} from './three-world-view.js';
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
  let disposed=false,world=null,last=0,view=null,following=true,shown=game.artShown;
  const nativeTick=game.tick.bind(game),nativeRender=game.app.render.bind(game.app),nativeResize=game.resize.bind(game),nativeInterior=game.onInteriorChange;
  const layer=document.createElement('div');layer.className='pixi-earth-view';Object.assign(layer.style,{position:'absolute',inset:0,zIndex:'1',background:'#000'});host.append(layer);
  const home=document.createElement('button');home.className='pixi-earth-find';home.textContent='Your duck';home.type='button';Object.assign(home.style,{position:'absolute',bottom:'20px',left:'50%',transform:'translateX(-50%)',zIndex:3});layer.append(home);
  const objects=()=>[...game.rigs.filter((r,i)=>game.localDucks[i]?.player).map(r=>r.root),...[...game.liveRigs.values()].map(e=>e.rig?.root),...(game.travelView?.transient()??[])].filter(Boolean);
  const originalIsletUpdate=game.isletView?.update.bind(game.isletView);
  if(originalIsletUpdate)game.isletView.update=(id,...args)=>originalIsletUpdate(view?.id??id,...args);
  game.app.render=()=>{
    if(game.interior?.active)return nativeRender();
    const hidden=[game.ocean,game.archipelago?.root].filter(Boolean).map(o=>[o,o.visible]);hidden.forEach(([o])=>o.visible=false);
    const moved=[];
    if(view&&view.id!==game.islandId)for(const o of objects()){
      const saved={o,x:o.x,y:o.y,z:o.zIndex,visible:o.visible};moved.push(saved);
      const p=mapPoint(game.islandId,view.id,o);o.position.set(p.x,p.y);o.zIndex=saved.z+p.y-saved.y;
      o.visible=Math.abs(p.x-game.camera.x)<game.width/game.camera.zoom&&Math.abs(p.y-game.camera.y)<game.height/game.camera.zoom;
    }
    try{nativeRender();}finally{for(const [o,v]of hidden)o.visible=v;for(const s of moved){s.o.position.set(s.x,s.y);s.o.zIndex=s.z;s.o.visible=s.visible;}}
  };
  game.duckLabelPosition=pose=>world?.project(game.islandId,pose.x,pose.y-165)??{x:-1000,y:-1000};
  game.placeLabel=(label,x,y)=>{label.hidden=!view||view.altitude>.5||x<0||y<0||x>host.clientWidth||y>host.clientHeight;if(!label.hidden)label.style.translate=`${x}px ${y}px`;};
  game.liveCopies=()=>[];game.buildCopies=()=>{};
  game.resize=()=>{if(game.interior?.active)return nativeResize();game.width=game.height=1536;game.app.renderer.resolution=1;game.app.renderer.resize(1536,1536);};
  const find=()=>{const p=game.room?.view()??game.player,m=mapOf(game.islandId);following=true;world?.centreOn(game.islandId,p?.x??m.cx,(p?.y??m.cy)-90,.12,true);};
  game.listen(window,'keydown',e=>{if(e.key.toLowerCase()==='f'&&!/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)&&!e.target?.isContentEditable)find();});
  game.flyHome=find;game.fit=()=>{following=false;world?.world();};home.onclick=find;
  function interior(active){
    nativeInterior(active);
    layer.style.display=active?'none':'';game.canvas.style.visibility=active?'':'hidden';world?.setActive(!active);
    if(active){game.externalCamera=null;game.tick=nativeTick;nativeResize();game.raf=requestAnimationFrame(nativeTick);}
    else{cancelAnimationFrame(game.raf);game.tick=()=>{};game.resize();last=0;find();}
  }
  game.onInteriorChange=interior;
  function update(state){
    if(disposed||!world||!game.ready||game.interior?.active)return;
    view=state;const now=performance.now();if(now-last<1000/(state.altitude>.6?20:60)-.5)return;last=now;
    const id=state.id,map=mapOf(id),mapId=artOf(id);
    if(shown!==mapId||game.artShown!==mapId){world.clearLiveCanvas();shown=mapId;game.wantedArts=new Set(['home',mapId]);game.artShown=mapId;game.showArt(mapId);game.applyMapAmbience(mapId);}
    game.ensureArt(mapId);
    const span=2*Math.tan(state.fov*Math.PI/360)*state.altitude*WORLD_GEO.Rw;
    const zoom=game.width/(span*Math.max(1,state.width/state.height))*.8;
    game.minZoom=.00001;game.zoomAnchor=null;game.zoomMotion.velocity=0;game.spin=null;game.globeAim=null;game.fly=null;game.follow=false;game.fitMode=false;game.landingView=null;game.globeT=0;
    game.externalCamera={x:map.cx+state.point.x,y:map.cy+state.point.y,zoom};
    Object.assign(game.camera,game.externalCamera);delete game.camera.basis;Object.assign(game.target,game.camera);
    nativeTick(now);cancelAnimationFrame(game.raf);
    if(game.interior?.active)return;
    const p=game.room?.view()??game.player;
    const moving=game.keys.size>0||game.touchInput.x||game.touchInput.y;
    if(moving)following=true;
    if(following&&p&&state.altitude<.55)world.centreOn(game.islandId,p.x,p.y-90);
    if(state.altitude<1.8&&game.artReady(mapId))world.setLiveCanvas(id,game.canvas,flatRigid(id,id),atlasCameraMatrix(game.camera,game.width,game.height,TILT),game.width,game.height,{x:game.camera.x-map.cx,y:game.camera.y-map.cy,width:game.width/zoom,height:game.height/zoom});
    else if(state.altitude>=1.8)world.clearLiveCanvas();
    home.hidden=!p||state.altitude<.5;
    if(game.nameLayer)game.nameLayer.style.opacity=state.altitude>.5?'0':'';
    const c=layer.querySelector('canvas[data-renderer="threejs"]');if(c){c.dataset.playerIsland=game.islandId;c.dataset.livePlayerCount=String(game.liveRigs.size);c.dataset.gameIntegrated='true';}
  }
  try{
    world=await createThreeWorld(layer,{onFrame:update,onInteract:()=>{following=false;},onTap:({id,x,y})=>{
      if(!game.player)return;
      const frame=WORLD_ISLANDS.find(i=>i.id===id),own=WORLD_ISLANDS.find(i=>i.id===game.islandId);
      const p=surfaceCoordinates(own,surfacePoint(frame,x,y,WORLD_GEO.Rw),WORLD_GEO.Rw),m=mapOf(game.islandId);
      const target={x:p.x+m.cx,y:p.y+m.cy};
      const screen={x:game.width/2+(target.x-game.camera.x)*game.camera.zoom,y:game.height/2+(target.y-game.camera.y)*game.camera.zoom*TILT};
      game.tap(screen);following=id===game.islandId;
    }});
    if(disposed){world.destroy();return;}
    cancelAnimationFrame(game.raf);game.tick=()=>{};game.resize();game.canvas.style.visibility='hidden';game.app.renderer.background.alpha=0;
    game.canvas.dataset.earthView='active';find();
  }catch(error){layer.remove();game.app.render=nativeRender;game.tick=nativeTick;game.resize=nativeResize;game.onInteriorChange=nativeInterior;throw error;}
  return {destroy(){disposed=true;world?.destroy();layer.remove();}};
}
