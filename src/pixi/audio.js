const urls=Object.fromEntries(['quack','pop','splash','step'].map(n=>[n,new URL(`../../rive/web/audio/${n}.wav`,import.meta.url).href]));
export function createAudio(){
 let context,muted=false,disposed=false,loading;const buffers=new Map(),sources=new Set();
 async function unlock(){
  if(disposed)return;
  context ||= new AudioContext();await context.resume();
  loading ||= Promise.all(Object.entries(urls).map(async([name,url])=>{try{const response=await fetch(url);if(!response.ok)return;const buffer=await context.decodeAudioData(await response.arrayBuffer());if(!disposed)buffers.set(name,buffer);}catch{/* A missing sound must not interrupt the island. */}}));
  await loading;
 }
 function play(name,volume=.1){
  if(disposed||!context||muted||context.state!=='running')return;
  if(!buffers.has(name)){const requested=performance.now();loading?.then(()=>{if(buffers.has(name)&&performance.now()-requested<800)play(name,volume);});return;}
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(name);gain.gain.value=volume;source.connect(gain).connect(context.destination);sources.add(source);
  source.onended=()=>{sources.delete(source);source.disconnect();gain.disconnect();};source.start();
 }
 return {unlock:()=>unlock().catch(()=>{}),play,get muted(){return muted;},toggle(){muted=!muted;if(muted)for(const source of sources)source.stop();},suspend(){context?.suspend().catch(()=>{});},resume(){if(context)context.resume().catch(()=>{});},dispose(){disposed=true;buffers.clear();for(const source of sources)source.stop();sources.clear();context?.close().catch(()=>{});}};
}
