// The dedicated arena opens directly in local island coordinates. It is not a
// globe landing, so none of the previous Home frame or landing inertia applies.
export function setBogReviewCamera(game,x,y,zoom=.65){
 game.follow=false;game.fitMode=false;game.fly=null;game.spin=null;
 game.landingView=null;game.globeAim=null;game.globeT=0;game.birdEye=false;
 game.zoomMotion.velocity=0;
 for(const v of [game.camera,game.target]){for(const k of Object.keys(v))if(!["x","y","zoom"].includes(k))delete v[k];Object.assign(v,{x,y,zoom});}
 if(game.scene)game.scene.visible=true;
}

// Browser panes can throttle RAF until they receive focus. Art readiness and
// the initial paint must not depend on a user click or a foreground animation.
export async function waitForBogArt(game,{cancelled=()=>false,nextFrame=()=>new Promise(resolve=>setTimeout(resolve,16))}={}){
 while(!cancelled()&&!game.disposed){
  const art=game.arts?.get('bog-arena');
  if(art?.failed)throw Error('Bog island artwork failed to load');
  if(art?.ready){game.showArt('bog-arena');return true;}
  await nextFrame();
 }
 return false;
}

export function paintBogFrame(game,x,y,zoom=.65){
 game.resize();
 setBogReviewCamera(game,x,y,zoom);
 game.showArt(game.artShown);
 cancelAnimationFrame(game.raf);
 game.accumulator=0;
 game.lastFrame=performance.now();
 game.tick(game.lastFrame,{forceRender:true});
}
