// Keep expensive SVG decode/raster work bounded and allow input/paint between
// jobs. Stop scheduling as soon as the owning world has been destroyed.
export function yieldWorldPaint(frame=globalThis.requestAnimationFrame,timer=setTimeout){
  // A zero-delay timer alone can run before the first animation frame. Put
  // decode work after an animation callback and the following paint opportunity.
  return new Promise(resolve=>typeof frame==='function'?frame.call(globalThis,()=>timer(resolve,0)):timer(resolve,0));
}
export async function loadWorldAssets(tasks,{concurrency=2,stopped=()=>false,onLoaded=()=>{},onError=()=>{},yieldFrame=yieldWorldPaint}={}){
  let next=0;
  async function worker(){
    while(!stopped()){
      const index=next++;if(index>=tasks.length)return;
      await yieldFrame();if(stopped())return;
      try{await tasks[index]();if(!stopped())onLoaded(index);}catch(error){if(!stopped())onError(error,index);}
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,tasks.length)},worker));
}
