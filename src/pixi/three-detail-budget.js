export const DETAIL_BLEND_START = .36;

export function detailWork(altitude,wasVisible=false,landing=false){
  // Selecting an island stops at .65, where the orbit atlas already looks
  // soft. Keep live detail through that stop and the next zoom-out step.
  const visible=altitude<(wasVisible?1:.9);
  // In the curved view, Three can move the globe every frame while reusing
  // the last Pixi capture. The final handoff needs a capture every frame.
  const hz=!visible?20:altitude>=DETAIL_BLEND_START?30:60;
  return {visible,preload:landing||altitude<1.2,hz};
}

// Shortcuts such as 0, Q and M do not mean the player started walking.
export function detailMovement(keys,touch={x:0,y:0}){
  const x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+(touch.x||0);
  const y=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))+(touch.y||0);
  return Boolean(x||y);
}
