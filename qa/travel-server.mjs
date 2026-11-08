import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const {outputFiles:[bundle]}=await build({stdin:{resolveDir:root,contents:`
  import {IslandRoom} from './worker/index.js';
  export class TravelTestRoom extends IslandRoom {
    async fetch(request) {
      const path=new URL(request.url).pathname;
      if (path === '/__test/session') {
        const account=await request.text();
        this.sql.exec('INSERT OR REPLACE INTO accounts (account,login) VALUES(?,?)',account,account);
        this.sql.exec('INSERT OR REPLACE INTO sessions (digest,account,login,expires,can_play,github_token) VALUES(?,?,?,?,1,?)',account,account,account,Date.now()+86400000,'local-fixture');
        return new Response(null,{status:204});
      }
      if (path === '/__test/state') return Response.json({boats:this.boats,players:[...this.connections.values()].map(info=>info.actor).filter(Boolean)});
      if (path === '/__test/pose') {
        const {account,pose,steps=0}=await request.json();
        const entry=[...this.connections].find(([,info])=>info.account===account && info.actor);
        if (entry) {Object.assign(entry[1].actor,pose); this.attach(...entry);
          // a sailing pose takes its boat along (boss 8 Nov: shots of a boat in Home's rivers)
          const boat=pose.mode==='sailing'&&this.boats.find(b=>b.id===pose.boatId);
          if(boat){boat.occupant=entry[1].actor.id;Object.assign(boat,{x:pose.x,y:pose.y,turn:pose.turn??boat.turn,islandId:entry[1].actor.islandId});this.boatsDirty=true;this.saveBoats();}}
        for (let i=0;i<Math.min(steps,1000);i++) this.step();
        this.broadcast();
        return new Response(null,{status:204});
      }
      return super.fetch(request);
    }
  }
  export default {async fetch(request,env) {
    const url=new URL(request.url), path=url.pathname;
    const account=request.headers.get('Cookie')?.match(/(?:^|; )test_user=([a-z0-9-]+)/)?.[1];
    const room=env.ISLAND.get(env.ISLAND.idFromName('main-island'));
    if (path === '/__test/login') return new Response(null,{status:302,headers:{Location:'/', 'Set-Cookie':'test_user='+ (url.searchParams.get('account') || 'traveler') +'; Path=/; HttpOnly; SameSite=Lax'}});
    if (path.startsWith('/__test/')) return room.fetch(new Request('https://test.internal'+path,request));
    if (path === '/api/session') return Response.json({user:account?{accountId:account,login:account,canPlay:true}:null,signInAvailable:false});
    if (path === '/api/friends') {
      if (!account) return Response.json({error:'Please sign in.'},{status:401});
      if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) return new Response(null,{status:403});
      await room.fetch(new Request('https://test.internal/__test/session',{method:'POST',body:account}));
      const data = request.method === 'GET' ? {} : await request.json();
      return room.fetch(new Request('https://test.internal/friends',{method:'POST',body:JSON.stringify({...data,digest:account,method:request.method})}));
    }
    if (path === '/api/outfit') {
      if (request.method !== 'POST' || request.headers.get('Origin') !== url.origin) return new Response(null,{status:403});
      const data=await request.json();
      return room.fetch(new Request('https://test.internal/outfit',{method:'POST',body:JSON.stringify({digest:account,outfit:data.outfit})}));
    }
    if (path === '/api/room') {
      if (account) await room.fetch(new Request('https://test.internal/__test/session',{method:'POST',body:account}));
      const headers=new Headers({Upgrade:'websocket'});
      if (account) headers.set('X-Session-Digest',account);
      return room.fetch(new Request('https://test.internal/room?play='+url.searchParams.get('play'),{headers}));
    }
    return env.ASSETS.fetch(request);
  }};
`},bundle:true,format:'esm',write:false});
// DUCKY_PORT / DUCKY_ASSETS: a second fixture on another port with its own build (never 8890's dist)
const mf=new Miniflare(convertV4MiniflareOptions({
  host:'127.0.0.1',port:Number(process.env.DUCKY_PORT)||8890,modules:[{type:'ESModule',path:'index.js',contents:bundle.text}],
  compatibilityDate:'2026-11-02',
  assets:{directory:process.env.DUCKY_ASSETS||root+'dist',binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true}},
  durableObjects:{ISLAND:{className:'TravelTestRoom',useSQLite:true}},
}));
console.log('Local travel test fixture:',String(await mf.ready));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await mf.dispose();process.exit();});
