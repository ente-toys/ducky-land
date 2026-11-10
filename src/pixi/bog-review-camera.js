// The dedicated arena opens directly in local island coordinates. It is not a
// globe landing, so none of the previous Home frame or landing inertia applies.
export function setBogReviewCamera(game,x,y,zoom=.65){
 game.follow=false;game.fitMode=false;game.fly=null;game.spin=null;
 game.landingView=null;game.globeAim=null;game.globeT=0;game.birdEye=false;
 game.zoomMotion.velocity=0;
 for(const v of [game.camera,game.target]){for(const k of Object.keys(v))if(!["x","y","zoom"].includes(k))delete v[k];Object.assign(v,{x,y,zoom});}
 if(game.scene)game.scene.visible=true;
}

export async function waitForBogArt(game,{cancelled=()=>false,nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve))}={}){
 while(!cancelled()&&!game.disposed){
  const art=game.arts?.get('bog-arena');
  if(art?.failed)throw Error('Bog island artwork failed to load');
  if(art?.ready){game.showArt('bog-arena');return true;}
  await nextFrame();
 }
 return false;
}
