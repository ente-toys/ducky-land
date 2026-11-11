// Local-only test Worker. Never import from production entrypoints.
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {fileURLToPath} from 'node:url';
export async function createAuditServer({port=8941,browser=false}={}){
const root=fileURLToPath(new URL('../',import.meta.url));
const {outputFiles:[bundle]}=await build({stdin:{resolveDir:root,contents:`
import {IslandRoom} from './worker/index.js';
export class AuditRoom extends IslandRoom {
 constructor(ctx){super(ctx);this.durations=[];this.closeEvents=[];}
 webSocketClose(socket,code,reason,wasClean){this.closeEvents.push({state:socket.readyState,code,wasClean});if(this.closeEvents.length>8)this.closeEvents.shift();super.webSocketClose(socket,code,reason,wasClean);}
 step(){const at=performance.now();super.step();if(this.durations.length<40000)this.durations.push(performance.now()-at);}
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==='/test/session'){const account=await request.text();this.sql.exec('INSERT OR REPLACE INTO sessions(digest,account,login,expires,can_play,github_token) VALUES(?,?,?,?,1,?)',account,account,account,Date.now()+3600000,'local-fixture');return new Response(null,{status:204});}
  if(path==='/test/pose'){const {account,islandId,x,y}=await request.json();const entry=[...this.connections].find(([,i])=>i.account===account&&i.actor);if(!entry)return new Response(null,{status:404});Object.assign(entry[1].actor,{islandId,x,y,path:[],travel:0});entry[1].islandId=islandId;this.attach(...entry);this.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)',account,5);this.karma.balances.set(account,5);this.broadcast();return new Response(null,{status:204});}
  if(path==='/test/stats'){const counts={};let actors=0;for(const i of this.connections.values())if(i.actor){actors++;counts[i.actor.islandId]=(counts[i.actor.islandId]??0)+1;}const durations=this.durations.splice(0).sort((a,b)=>a-b);return Response.json({connections:this.connections.size,actors,counts,closeEvents:this.closeEvents,timer:Boolean(this.timer),samples:durations.length,p95:durations[Math.floor(durations.length*.95)]??0,max:durations.at(-1)??0});}
  return super.fetch(request);
 }
}
export default {async fetch(request,env){const url=new URL(request.url),room=env.ISLAND.get(env.ISLAND.idFromName(url.searchParams.get('room')||'audit'));if(url.pathname.startsWith('/test/'))return room.fetch(request);const headers=new Headers({Upgrade:'websocket'});const account=url.searchParams.get('account')||(${browser}?'browser-test':null);if(account){await room.fetch(new Request('https://test/test/session',{method:'POST',body:account}));headers.set('X-Session-Digest',account);}if(${browser}&&url.pathname==='/arena-room')return room.fetch(new Request('https://test/bog-room'+url.search,{headers}));if(${browser}&&url.pathname==='/api/session')return Response.json({user:{accountId:account,login:'Local audit',canPlay:true},signInAvailable:false});if(${browser}&&['/api/outfit','/api/friends'].includes(url.pathname)){const data=request.method==='GET'?{}:await request.json();return room.fetch(new Request('https://test/'+url.pathname.slice(5),{method:'POST',body:JSON.stringify({...data,digest:account,method:request.method})}));}return room.fetch(new Request('https://test/room?play='+url.searchParams.get('play'),{headers}));}};
`},bundle:true,format:'esm',write:false});
const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port,compatibilityDate:'2026-11-02',modules:[{type:'ESModule',path:'audit.js',contents:bundle.text}],durableObjects:{ISLAND:{className:'AuditRoom',useSQLite:true}}}));
await mf.ready;return mf;
}
