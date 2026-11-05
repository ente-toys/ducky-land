import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const {outputFiles:[bundle]}=await build({stdin:{resolveDir:root,contents:`
  import {IslandRoom} from './worker/index.js';
  export class TravelTestRoom extends IslandRoom {
    async fetch(request) {
      const path=new URL(request.url).pathname;
      if (path === '/__test/state') return Response.json({boats:this.boats,players:[...this.connections.values()].map(info=>info.actor).filter(Boolean)});
      if (path === '/__test/pose') {
        const {account,pose,steps=0}=await request.json();
        const entry=[...this.connections].find(([,info])=>info.account===account && info.actor);
        if (entry) {Object.assign(entry[1].actor,pose); this.attach(...entry);}
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
    if (path === '/api/session') return Response.json({user:account?{login:account,canPlay:true}:null,signInAvailable:false});
    if (path === '/api/room') {
      if (account) await room.fetch(new Request('https://test.internal/session/new',{method:'POST',body:JSON.stringify({digest:account,account,login:account,canPlay:true,githubToken:'local-fixture'})}));
      const headers=new Headers({Upgrade:'websocket'});
      if (account) headers.set('X-Session-Digest',account);
      return room.fetch(new Request('https://test.internal/room?play='+url.searchParams.get('play'),{headers}));
    }
    return env.ASSETS.fetch(request);
  }};
`},bundle:true,format:'esm',write:false});
const mf=new Miniflare(convertV4MiniflareOptions({
  host:'127.0.0.1',port:8890,modules:[{type:'ESModule',path:'index.js',contents:bundle.text}],
  compatibilityDate:'2026-11-02',
  assets:{directory:root+'dist',binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true}},
  durableObjects:{ISLAND:{className:'TravelTestRoom',useSQLite:true}},
}));
console.log('Local travel test fixture:',String(await mf.ready));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await mf.dispose();process.exit();});
