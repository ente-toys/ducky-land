import {createBogCombat} from '../src/pixi/bog-combat/sim.js';
import {BOG_COMBAT} from '../src/pixi/bog-combat/config.js';
import {BOG_ISLAND,canEnterBog,teamCounts,suggestedTeam} from '../src/pixi/bog-combat/entry.js';
import {emptyStats,TEAMS} from '../src/pixi/bog-combat/rules.js';
import {cleanMedalCase} from '../src/pixi/bog-combat/medals.js';
import {mapOf} from '../src/pixi/island-maps.js';

// Production transport for the existing combat simulation. Account identity
// comes from the same signed-in room that admitted the boat, never a URL token.
export class LiveBogRoom {
 constructor(owner){
  this.owner=owner;this.members=new Map();
  owner.sql.exec('CREATE TABLE IF NOT EXISTS bog_profiles (account TEXT PRIMARY KEY, stats TEXT NOT NULL, medals TEXT NOT NULL)');
  this.arena=createBogCombat({...BOG_COMBAT,onStats:(account,stats,medals)=>{
   owner.sql.exec('INSERT OR REPLACE INTO bog_profiles VALUES(?,?,?)',account,JSON.stringify(stats),JSON.stringify(medals));
  }});
 }
 profile(account){
  const row=this.owner.sql.exec('SELECT stats,medals FROM bog_profiles WHERE account=?',account).toArray()[0];
  return {stats:row?JSON.parse(row.stats):emptyStats(),medalCase:row?cleanMedalCase(JSON.parse(row.medals)):{}};
 }
 admitted(digest){
  const user=this.owner.session(digest);
  const info=user?.canPlay&&[...this.owner.connections.values()].find(i=>i.account===user.account&&i.actor);
  const p=info?.actor;
  return p?.islandId===BOG_ISLAND&&p.mode==='walking'&&mapOf(BOG_ISLAND).nav().walkable(p.x,p.y)
   &&canEnterBog(this.owner.getPlayerKarma(p,user.account))?{user,info}:null;
 }
 open(socket,{digest,team=null,id=crypto.randomUUID()}){
  const allowed=this.admitted(digest);
  if(!allowed||team!==null&&!TEAMS.includes(team))return false;
  const {user,info}=allowed;
  // One signed-in participant per account, just like the world room.
  if(team)for(const [peer,m]of this.members)if(m.account===user.account&&m.team){this.close(peer);peer.close(4001,'Arena session replaced by reconnect');}
  const m={digest,account:user.account,id,team,tokens:90,tokenAt:Date.now()};
  if(team){
   Object.assign(info,{input:{x:0,y:0},inputExpires:0,boarding:null,landing:null});
   Object.assign(info.actor,{path:[],pace:0,heading:null});
   this.arena.join({id,team,profile:user.account,name:user.login,...this.profile(user.account)});
  }
  this.members.set(socket,m);
  socket.serializeAttachment({bog:{digest,team,id}});
  if(team){this.owner.send(socket,{type:'arena-welcome',id,hz:60});this.owner.send(socket,this.arena.snapshot());}
  this.broadcast();
  if(team&&!this.timer){this.timer=setInterval(()=>this.step(),1000/60);this.timer.unref?.();}
  return true;
 }
 lobby(account){const counts=teamCounts(this.arena.state.players.values());return {type:'arena-lobby',counts,suggested:suggestedTeam(counts),...this.profile(account)};}
 broadcast(){
  const snapshot=this.arena.snapshot();
  for(const [socket,m]of this.members)this.owner.send(socket,m.team?snapshot:this.lobby(m.account));
 }
 message(socket,message){
  const m=this.members.get(socket);if(!m)return;
  if(!this.admitted(m.digest)){this.close(socket);socket.close(1008,'Return to the Bog harbour');return;}
  const now=Date.now();m.tokens=Math.min(90,m.tokens+Math.max(0,now-m.tokenAt)*.09)-1;m.tokenAt=now;
  if(typeof message!=='string'||message.length>2048||m.tokens<0){this.close(socket);socket.close(1008,'Invalid arena input');return;}
  let data;try{data=JSON.parse(message);}catch{return;}
  if(m.team&&data?.type==='arena-input')this.arena.input(m.id,data);
 }
 step(){
  for(const [socket,m]of this.members)if(socket.readyState!==1||!this.admitted(m.digest)){
   this.close(socket);socket.close(1008,'Bog visit ended');
  }
  if(!this.arena.state.players.size)return;
  this.arena.step(1/60);
  if(this.arena.state.tick%3===0)this.broadcast();
 }
 close(socket){
  const m=this.members.get(socket);if(!m)return;
  if(m.team)this.arena.leave(m.id);
  this.members.delete(socket);
  if(!this.arena.state.players.size){clearInterval(this.timer);this.timer=null;}
  this.broadcast();
 }
 dispose(){for(const socket of [...this.members.keys()])this.close(socket);}
}
