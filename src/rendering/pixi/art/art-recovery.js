import {Texture} from 'pixi.js';

export const ART_TIMEOUT_MS=4000;
const placeholderMark=Symbol.for('ducky.art-placeholder');
export const isArtPlaceholder=texture=>texture?.[placeholderMark]===true;
export function artPlaceholder() {
  // A distinct Texture preserves ownership without destroying EMPTY's source.
  const texture=new Texture({source:Texture.EMPTY.source});
  texture[placeholderMark]=true;return texture;
}
export function finalTextureSource(texture) {
  const source=texture?.source;
  return source&&texture!==Texture.EMPTY&&source!==Texture.EMPTY.source&&!texture.destroyed&&!source.destroyed&&
    source.pixelWidth>0&&source.pixelHeight>0?source:null;
}

// One retry and one deadline for the whole piece, including a stalled promise.
// Late results cannot write to the scene. Callers retain their normal lease
// until destruction, and balance an extra acquisition before retrying.
export function recoverArt(job,{label='Island art',valid=()=>true,fallback=()=>undefined,
  retry=()=>{},late=()=>{},cancelled=()=>false,timeoutMs=ART_TIMEOUT_MS}={}) {
  return new Promise(resolve=>{
    let done=false,attempts=0,lastError,accepted;
    const finish=value=>{if(done)return;done=true;accepted=value;clearTimeout(deadline);clearTimeout(retryTimer);resolve(value);};
    const run=()=>{
      if(done||attempts===2)return;
      attempts++;
      let result;
      try {result=job();}catch(error){result=Promise.reject(error);}
      Promise.resolve(result).then(value=>{
        if(done){
          if(value!==accepted)try{late(value);}catch(error){console.warn(`${label}: late art cleanup failed`,error);}
          return;
        }
        if(cancelled()){finish(value);return;}
        try {
          if(valid(value))finish(value);
          else {lastError=Error('texture is not final');again();}
        }catch(error){lastError=error;again();}
      },error=>{lastError=error;again();});
    };
    const again=()=>{
      if(done||attempts===2)return;
      if(cancelled()){finish(fallback());return;}
      try {retry();}catch(error){lastError=error;}
      run();
    };
    const deadline=setTimeout(()=>{
      if(done)return;
      if(cancelled()){finish(fallback());return;}
      console.warn(`${label}: accepting degraded art after ${timeoutMs} ms (${lastError?.message??'art preparation timed out'})`);
      finish(fallback());
    },timeoutMs);
    const retryTimer=setTimeout(again,timeoutMs/2);
    run();
  });
}

export const acquireArt=(acquire,release,src,resolution,options={})=>recoverArt(()=>acquire(src,resolution),{
  label:src,valid:texture=>!!finalTextureSource(texture)||isArtPlaceholder(texture),fallback:artPlaceholder,
  retry:()=>release(src),...options,
});

// Scene-mutating startup work runs once. Bound the wait without starting a
// second concurrent builder when a slow operation misses its deadline.
export function settleArtStep(job,{label='Island startup',timeoutMs=8000,cancelled=()=>false,fallback}={}) {
  let promise;
  return recoverArt(()=>promise??=Promise.resolve().then(job),{label,timeoutMs,cancelled,fallback});
}
