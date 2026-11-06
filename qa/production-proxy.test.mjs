import test from 'node:test';
import assert from 'node:assert/strict';
import {productionProxy,PRODUCTION_ORIGIN,productionSignIn} from '../scripts/vite-production-proxy.mjs';

test('API HTTP and WebSocket proxies preserve requests while adapting same-origin loopback traffic',()=>{
  const proxy=productionProxy()['/api'],events={};proxy.configure({on:(event,fn)=>events[event]=fn});
  assert.equal(proxy.target,PRODUCTION_ORIGIN);assert.equal(proxy.ws,true);assert.equal(proxy.changeOrigin,true);
  for(const event of ['proxyReq','proxyReqWs']) {
    for(const host of ['localhost:5173','127.0.0.1:5174','[::1]:5173']) {
      const headers={};events[event]({setHeader:(k,v)=>headers[k]=v},{headers:{host,origin:'http://'+host}});
      assert.equal(headers.Origin,PRODUCTION_ORIGIN);
    }
    for(const origin of ['https://unrelated.example','http://localhost:9999','null',undefined]) {
      const headers={};events[event]({setHeader:(k,v)=>headers[k]=v},{headers:{host:'localhost:5173',origin}});
      assert.deepEqual(headers,{});
    }
  }
});
test('GitHub authentication starts on production so its callback can read its secure cookie',()=>{
  let middleware;productionSignIn().configureServer({middlewares:{use:fn=>middleware=fn}});
  let status,headers,ended=false,next=false;
  middleware({method:'GET',url:'/auth/github/start'},{writeHead:(s,h)=>{status=s;headers=h;},end:()=>ended=true},()=>next=true);
  assert.equal(status,302);assert.equal(headers.Location,PRODUCTION_ORIGIN+'/auth/github/start');assert.equal(ended,true);assert.equal(next,false);
  middleware({method:'GET',url:'/api/session'},{},()=>next=true);assert.equal(next,true);
});
