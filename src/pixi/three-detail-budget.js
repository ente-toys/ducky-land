// The globe atlas is sufficient at orbit distance. Prepare the approaching
// island before exposing live detail, but do not run its animated Pixi scene
// or upload its canvas while it is still small on the sphere.
export function detailWork(altitude,wasVisible=false){
  const visible=altitude<(wasVisible?.7:.6);
  return {visible,preload:altitude<.85,hz:visible?60:20};
}

// Shortcuts such as 0, Q and M do not mean the player started walking.
export function detailMovement(keys,touch={x:0,y:0}){
  const x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+(touch.x||0);
  const y=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))+(touch.y||0);
  return Boolean(x||y);
}
