import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BOG_COMBAT} from '../src/features/bog-combat/config.js';
import {getBogBlockers} from '../src/features/bog-combat/blockers.js';
import {BOG_BLOCKERS} from '../src/features/bog-combat/bog-blockers.js';
import {mapOf,THEME_OF} from '../src/world/island-maps.js';
import {createArenaSocket,createArenaProfiles} from '../server/arena-socket.mjs';
import {ArenaClient,ArenaLobbyClient} from '../src/features/bog-combat/client.js';
import {createBogCombat} from '../src/features/bog-combat/sim.js';
import {traceShot} from '../src/features/bog-combat/physics.js';
import {RULES} from '../src/features/bog-combat/rules.js';

test('integrated defaults use all real Bog footprints without globally replacing the world island',()=>{
  assert.equal(THEME_OF.get('isle-249'),'bog');
  assert.notEqual(mapOf('isle-249').id,'bog-arena');
  assert.equal(getBogBlockers().length,BOG_BLOCKERS.length);
  assert.equal(getBogBlockers(),getBogBlockers());
  for(const raw of BOG_BLOCKERS){
    const b=BOG_COMBAT.blockers.find(b=>b.id===raw.id),cx=raw.x+raw.width/2,cy=raw.y+raw.height/2;
    assert.deepEqual(b.polygon,[{x:raw.x,y:raw.y},{x:raw.x+raw.width,y:raw.y},{x:raw.x+raw.width,y:raw.y+raw.height},{x:raw.x,y:raw.y+raw.height}]);
    assert.equal(BOG_COMBAT.navigation.walkable(cx,cy),false,raw.id+' blocks normal walking');
    assert.equal(traceShot({x:raw.x-2,y:cy},{x:raw.x+raw.width+2,y:cy},[b]).blocker,b,raw.id+' blocks paint');
  }
  assert.equal(BOG_COMBAT.navigation.walkable(-100,3000),false,'no rectangular fallback outside coast');
  const arena=createBogCombat();
  for(const team of ['privacy','google'])for(let i=0;i<2;i++){
    const p=arena.join({id:team+i,team}),pad=BOG_COMBAT.pads(team)[i];
    assert.deepEqual([p.x,p.y,p.base],[pad.x,pad.y,pad.base]);
  }
});

test('real-map lobby -> both clients walk to mid -> shoot/tag -> respawn -> saved re-entry',async()=>{
  const file=join(mkdtempSync(join(tmpdir(),'bog2-flow-')),'profiles.json'),profiles=createArenaProfiles(file);
  let now=0;
  const server=new EventEmitter(),room=createArenaSocket(server,profiles,{combat:BOG_COMBAT,now:()=>now,log:()=>{}});
  class Socket {
    readyState=1;bufferedAmount=0;
    constructor(url){
      this.peer=new EventEmitter();Object.assign(this.peer,{readyState:1,bufferedAmount:0,
        send:data=>queueMicrotask(()=>{if(this.readyState===1)this.onmessage?.({data});}),
        close:(code=1000,reason='')=>this.close(code,reason),terminate:()=>this.close(),ping:()=>this.peer.emit('pong'),
      });
      queueMicrotask(()=>server.emit('connection',this.peer,{headers:{origin:'http://localhost:8897'},url:String(url)}));
    }
    send(data){this.peer.emit('message',Buffer.from(data),false);}
    close(code=1000,reason=''){if(this.readyState!==1)return;this.readyState=this.peer.readyState=3;this.peer.emit('close',code,Buffer.from(reason));this.onclose?.({code,reason});}
  }
  const clients=[],profile='integration_privacy_'.padEnd(36,'a');let lobbyData;
  const lobby=new ArenaLobbyClient({Socket,profile,onSnapshot:d=>{lobbyData=d;}});
  try{
    await Promise.resolve();await Promise.resolve();
    assert.deepEqual(lobbyData.counts,{privacy:0,google:0});assert.equal(room.arena.state.players.size,0);
    const a=new ArenaClient({...BOG_COMBAT,Socket,team:'privacy',profile,name:'Privacy'}),b=new ArenaClient({...BOG_COMBAT,Socket,team:'google',profile:'integration_google_'.padEnd(36,'b'),name:'Google'});clients.push(a,b);
    await Promise.resolve();await Promise.resolve();room.broadcast();await Promise.resolve();
    assert.deepEqual(lobbyData.counts,{privacy:1,google:1});
    const step=async(controls={})=>{
      now+=1000/60;
      for(const c of [a,b])c.control(controls[c.id]??{x:0,y:0},0,controls[c.id]?.fire??false,1/60,now);
      room.step();if(room.arena.state.tick%3===0){room.broadcast();await Promise.resolve();}
    };
    const walk=async(c,target)=>{
      const p=room.arena.state.players.get(c.id),nav=BOG_COMBAT.navigation,path=nav.route(p.x,p.y,...target);
      assert.ok(path.length,'mid can be reached from base');
      for(const waypoint of path){
        let n=0;
        while(Math.hypot(p.x-waypoint[0],p.y-waypoint[1])>12&&n++<2400){
          const dx=waypoint[0]-p.x,dy=waypoint[1]-p.y;
          await step({[c.id]:{x:dx,y:dy,run:Math.hypot(dx,dy)>70}});
          assert.ok(nav.walkable(p.x,p.y),'authority stays on real walk geometry');
        }
        assert.ok(n<2400,'walker reaches each route point');
      }
      for(let i=0;i<20;i++)await step();
    };
    await walk(a,[4000,3270]);await walk(b,[4320,3270]);
    const owner=room.arena.state.players.get(a.id),victim=room.arena.state.players.get(b.id);
    for(let i=0;i<2;i++)await step({[a.id]:{x:1,y:0}});
    for(let i=0;i<90&&victim.alive;i++)await step({[a.id]:{x:0,y:0,fire:true}});
    assert.equal(victim.alive,false);assert.equal(owner.stats.tags,1);assert.equal(owner.stats.score,10);assert.equal(owner.stats.medals,1);assert.ok(owner.medalCase['first-splat']);
    const deadAt={x:victim.x,y:victim.y},respawnAt=victim.respawnAt;
    while(room.arena.state.time<respawnAt-1/30){await step({[b.id]:{x:1,y:0,fire:true}});assert.equal(victim.x,deadAt.x);assert.equal(victim.y,deadAt.y);}
    while(!victim.alive)await step();
    const pad=BOG_COMBAT.pads('google')[1];assert.deepEqual([victim.x,victim.y,victim.base],[pad.x,pad.y,pad.base]);assert.ok(victim.shieldUntil>room.arena.state.time);
    room.broadcast();await Promise.resolve();assert.equal(a.self.stats.tags,1);assert.equal(b.self.alive,true);
    a.dispose();room.broadcast();await Promise.resolve();assert.deepEqual(lobbyData.counts,{privacy:0,google:1});
    profiles.flush();const reloaded=createArenaProfiles(file);assert.equal(reloaded.get(profile).tags,1);assert.ok(reloaded.getMedals(profile)['first-splat']);
    const again=new ArenaClient({...BOG_COMBAT,Socket,team:'google',profile,name:'Returned'});clients.push(again);await Promise.resolve();await Promise.resolve();
    assert.equal(again.self.stats.score,10);assert.equal(again.self.stats.bestStreak,1);assert.equal(again.self.streak,0);assert.ok(again.self.medalCase['first-splat']);
    assert.equal(RULES.respawnDelay,3);
  }finally{for(const c of clients)c.dispose();lobby.dispose();room.close();}
});
