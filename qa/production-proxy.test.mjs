import test from 'node:test';
import assert from 'node:assert/strict';
import {productionProxy,PRODUCTION_ORIGIN,productionSignIn} from '../scripts/vite-production-proxy.mjs';
import {connect} from '../server/pages-auth.js';
import {roomBindingFlags,sentryOptions} from '../server/sentry.js';

test('Sentry keeps safe room binding flags and correlates Pages failures by Ray ID',()=>{
  const {beforeSendLog}=sentryOptions({},'pages',new Set(['/api/room']));
  const flags=roomBindingFlags({overloaded:true,retryable:false,remote:'invalid',message:'private exception'});
  assert.deepEqual(flags,{overloaded:true,retryable:false});
  assert.deepEqual(beforeSendLog({message:'Pages request failed',attributes:{
    room_binding_route:'/session/get',...flags,token:'private',ray_id:'not-a-ray',
  }}).attributes,{service:'pages',room_binding_route:'/session/get',overloaded:true,retryable:false});
  assert.deepEqual(beforeSendLog({message:'Pages request failed',attributes:{
    route:'/api/room',ray_id:'a5c64ee86846e084-SIN',token:'private',
  }}).attributes,{service:'pages',route:'/api/room',ray_id:'a5c64ee86846e084-SIN'});
});

test('a failed room upgrade preserves the binding operation and original error for middleware',async()=>{
  const failure=Object.assign(new Error('private exception'),{overloaded:true});
  const data={};
  const env={ISLAND:{idFromName:()=>null,get:()=>({fetch:async()=>{throw failure;}})}};
  const request=new Request('https://room.example/api/room',{headers:{Upgrade:'websocket',Origin:'https://room.example'}});
  await assert.rejects(()=>connect({request,env,data}),error=>error===failure);
  assert.deepEqual(data.roomBindingFailure,{route:'/room',error:failure});
});

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
