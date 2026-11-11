// Diagnostics only. Timer queries are read after QUERY_RESULT_AVAILABLE, never
// gl.finish/readPixels. RAF cadence includes scheduling; GPU time covers our GL
// commands, not the browser compositor or the physical display scan-out.
export function createFrameMetrics(gl,{now=()=>performance.now(),sampleEvery=4,capacity=900}={}){
  const ext=gl?.getExtension('EXT_disjoint_timer_query_webgl2'),rows=[],pending=[];
  let last=null,index=0,workIndex=0,disjoint=0,disposed=false;
  const poll=()=>{
    if(!gl||disposed)return;
    if(ext&&gl.getParameter(ext.GPU_DISJOINT_EXT)){
      disjoint++;for(const p of pending.splice(0))gl.deleteQuery(p.query);return;
    }
    for(let i=pending.length-1;i>=0;i--){
      const p=pending[i];
      if(p.query){
        if(!gl.getQueryParameter(p.query,gl.QUERY_RESULT_AVAILABLE))continue;
        p.row.gpuMs=gl.getQueryParameter(p.query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(p.query);
      }else{
        const status=gl.clientWaitSync(p.fence,0,0);
        if(status===gl.TIMEOUT_EXPIRED)continue;
        if(status!==gl.WAIT_FAILED)p.row.gpuCompletionUpperBoundMs=now()-p.submitted;
        gl.deleteSync(p.fence);
      }
      pending.splice(i,1);
    }
  };
  const stats=values=>{
    values=values.filter(Number.isFinite).sort((a,b)=>a-b);
    return values.length?{samples:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p95:values[Math.floor(values.length*.95)],max:values.at(-1)}:null;
  };
  return {
    begin(timestamp){
      poll();
      const row={intervalMs:last===null?null:timestamp-last,cpuMs:0,kind:'idle'};last=timestamp;
      const start=now();let query;
      if(ext&&++index%sampleEvery===0&&pending.length<8&&!gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)){
        query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
      }else if(!ext)index++;
      return {row,start,query,sample:index%sampleEvery===0};
    },
    beginWork(){
      poll();const row={intervalMs:null,cpuMs:0},start=now();let query;
      const sample=++workIndex%sampleEvery===0;
      if(ext&&sample&&pending.length<8&&!gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)){query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}
      return {row,start,query,sample};
    },
    end(token,kind){
      if(!token||disposed)return;
      const {row,query}=token;row.cpuMs=now()-token.start;row.kind=kind;
      if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,row});}
      else if(!ext&&gl?.fenceSync&&token.sample&&pending.length<8){
        const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
        if(fence){pending.push({fence,row,submitted:now()});gl.flush();}
      }
      rows.push(row);if(rows.length>capacity)rows.shift();
    },
    summary(){
      poll();const groups={};
      for(const kind of ['idle','moving','globe','upload']){
        const selected=rows.filter(r=>r.kind===kind);if(!selected.length)continue;
        groups[kind]={...(kind==='upload'?{uploads:selected.length}:{frames:selected.length}),cpuMs:stats(selected.map(r=>r.cpuMs)),rafIntervalMs:stats(selected.map(r=>r.intervalMs)),gpuMs:stats(selected.map(r=>r.gpuMs)),gpuCompletionUpperBoundMs:stats(selected.map(r=>r.gpuCompletionUpperBoundMs)),gapsOver24ms:selected.filter(r=>r.intervalMs>24).length};
      }
      return {gpuTimerSupported:Boolean(ext),gpuFenceSupported:Boolean(gl?.fenceSync),disjointSamples:disjoint,groups};
    },
    resetCadence(){last=null;},
    destroy(){disposed=true;for(const p of pending.splice(0))p.query?gl.deleteQuery(p.query):gl.deleteSync(p.fence);},
  };
}
