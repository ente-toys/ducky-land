export const DETAIL_BLEND_START = .36;

export function detailWork(altitude,wasVisible=false,landing=false){
  const visible=altitude<(wasVisible?1:.9);
  const hz=!visible?20:altitude>=DETAIL_BLEND_START?30:60;
  return {visible,preload:landing||altitude<1.2,hz};
}

export function detailMovement(keys,touch={x:0,y:0}){
  const x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+(touch.x||0);
  const y=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))+(touch.y||0);
  return Boolean(x||y);
}
