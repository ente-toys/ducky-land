import {Container,RenderTexture,Sprite} from 'pixi.js';

// Copy already prepared art one cell per frame. Keep the same GPU target while
// filling it, rather than retaining an old and a replacement atlas together.
export function createAtlasBuild(renderer,{width,height,label,items,draw,prepare,retire,admit=()=>true,workQueue,texture,cellSize,antialias=false,valid=()=>true}) {
  // Reserve the mip chain, but do not generate an empty chain at allocation.
  // Generate it once, after the last cell, in its own frame. Keep the levels
  // and sampler after that, so static globes retain their minification quality.
  const target=texture??RenderTexture.create({width,height,scaleMode:'linear',antialias:false,autoGenerateMipmaps:false,
    mipLevelCount:Math.floor(Math.log2(Math.max(width,height)))+1,label});
  const scratch=cellSize?RenderTexture.create({width:cellSize,height:cellSize,antialias,scaleMode:'linear',label:`${label} cell`}):null;
  const copy=(item,index)=>{
    const sheet=new Container();
    try{
      sheet.addChild(draw(item,index));
      if(scratch){
        // MSAA resolves the whole target even with a cell viewport in Pixi.
        // Resolve a 512px cell, then copy it into the non-MSAA atlas.
        renderer.render({container:sheet,target:scratch,clear:true,clearColor:[0,0,0,0]});
        const cell=new Sprite(scratch),placement=new Container();
        cell.position.set(index%(width/cellSize)*cellSize,Math.floor(index/(width/cellSize))*cellSize);
        placement.addChild(cell);
        try{renderer.render({container:placement,target,clear:!texture&&index===0,clearColor:[0,0,0,0]});}
        finally{placement.destroy({children:true});}
      }else renderer.render({container:sheet,target,clear:!texture&&index===0,clearColor:[0,0,0,0]});
      retire?.(item,index);
    }
    finally{sheet.destroy({children:true});}
  };
  const mipmaps=()=>{target.source.autoGenerateMipmaps=true;try{target.source.updateMipmaps();}finally{target.source.autoGenerateMipmaps=false;}};
  if(!workQueue){try{items.forEach(copy);mipmaps();}finally{scratch?.destroy(true);}return {texture:target,ready:Promise.resolve()};}
  const ready=(async()=>{
    const run=job=>workQueue.enqueue(job,{priority:3},true,valid,true);
    try{
      // Shader bindings must wait for ready, otherwise lazy allocation escapes
      // the queue and can collide with the other atlas in the game rAF.
      await workQueue.enqueue(()=>{if(target.width!==width||target.height!==height)target.resize(width,height);renderer.texture?.initSource(target);},{priority:3},true,valid,true,admit);
      for(let i=0;i<items.length;i++){
        if(prepare)await run(()=>prepare(items[i],i));
        await run(()=>copy(items[i],i));
      }
      await run(mipmaps);
    }finally{scratch?.destroy(true);}
  })();
  return {texture:target,ready};
}
