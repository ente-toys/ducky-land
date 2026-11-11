import {createBogCombat} from '../src/pixi/bog-combat/sim.js';
import {BOG_COMBAT} from '../src/pixi/bog-combat/config.js';
import {BOG_ISLAND,canEnterBog,teamCounts,suggestedTeam} from '../src/pixi/bog-combat/entry.js';
import {emptyStats,TEAMS} from '../src/pixi/bog-combat/rules.js';
import {cleanMedalCase} from '../src/pixi/bog-combat/medals.js';
import {bogExitIslet} from './bog-exit.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {createBogBots} from './bog-bots.js';
import {ABILITY_TIMERS,saveAbilityTimers} from '../src/pixi/bog-combat/ability-state.js';

// Production transport for the existing combat simulation. Account identity
// comes from the same signed-in room that admitted the boat, never a URL token.
export class LiveBogRoom {
 constructor(owner){
  this.owner=owner;this.members=new Map();this.exits=[];this.saved=new Map();
  owner.sql.exec('CREATE TABLE IF NOT EXISTS bog_profiles (account TEXT PRIMARY KEY, stats TEXT NOT NULL, medals TEXT NOT NULL)');
  this.arena=createBogCombat({...BOG_COMBAT,onOut:p=>{if(!p.bot)this.exits.push(p);},onStats:(account,stats,medals)=>{
   owner.sql.exec('INSERT OR REPLACE INTO bog_profiles VALUES(?,?,?)',account,JSON.stringify(stats),JSON.stringify(medals));
  }});
  this.bots=createBogBots(this.arena,BOG_COMBAT);
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
   &&(this.owner.karma.bogEntry(user.account)||canEnterBog(this.owner.getPlayerKarma(p,user.account)))?{user,info}:null;
 }
 open(socket,{digest,team=null,id=crypto.randomUUID()}){
  const allowed=this.admitted(digest);
  if(!allowed||team!==null&&!TEAMS.includes(team))return false;
  const {user,info}=allowed;
  // Existing landed visitors are migrated once. Normal boat landings have
  // already created this paid entry; opening/restoring sockets never recharges.
  const visit=this.owner.karma.beginBogEntry(user.account);if(!visit)return false;
  info.actor.karma=this.owner.karma.balance(user.account);
  // One signed-in participant per account, just like the world room.
  if(team)for(const [peer,m]of this.members)if(m.account===user.account&&m.team){this.close(peer);peer.close(4001,'Arena session replaced by reconnect');}
  if(this.owner.karma.bogEntry(user.account)?.id!==visit.id)return false;
  const m={digest,account:user.account,entryId:visit.id,id,team:team?(visit.combat?.team??team):null,tokens:90,tokenAt:Date.now()};
  if(team){
   this.bots.replace(m.team);
   Object.assign(info,{input:{x:0,y:0},inputExpires:0,boarding:null,landing:null});
   Object.assign(info.actor,{path:[],pace:0,heading:null});
   const saved=this.owner.karma.bogEntry(user.account);
   const combat=saved.combat?{...saved.combat}:null;
   if(combat){const elapsed=Math.max(0,(Date.now()-(saved.savedAt??Date.now()))/1000);for(const key of ['shieldLeft','respawnLeft','nextFireLeft','reloadLeft',...Object.keys(ABILITY_TIMERS)])combat[key]=Math.max(0,(combat[key]??0)-elapsed);}
   this.arena.join({id,team:m.team,profile:user.account,name:user.login,...this.profile(user.account),lives:saved.lives,karma:info.actor.karma,combat});
   this.arena.state.players.get(id).entryId=visit.id;
   this.persist(this.arena.state.players.get(id));
  }
  this.members.set(socket,m);
  this.bots.sync();
  socket.serializeAttachment({bog:{digest,team:m.team,id}});
  if(team){this.owner.send(socket,{type:'arena-welcome',id,hz:60});this.owner.send(socket,this.snapshot(m.team));}
  this.broadcast();
  if(!this.timer){this.timer=setInterval(()=>this.step(),1000/60);this.timer.unref?.();}
  return true;
 }
 lobby(account){const counts=teamCounts(this.arena.state.players.values());return {type:'arena-lobby',counts,suggested:suggestedTeam(counts),...this.profile(account)};}
 snapshot(team){return {...this.arena.snapshot(team),botDepartures:this.bots.visibleDepartures(team)};}
 broadcast(){
  const snapshots=new Map();
  for(const [socket,m]of this.members){
   if(m.team&&!snapshots.has(m.team))snapshots.set(m.team,this.snapshot(m.team));
   this.owner.send(socket,m.team?snapshots.get(m.team):this.lobby(m.account));
  }
 }
 message(socket,message){
  const m=this.members.get(socket);if(!m)return;
  if(!this.admitted(m.digest)||this.owner.karma.bogEntry(m.account)?.id!==m.entryId){this.close(socket);socket.close(1008,'Return to the Bog harbour');return;}
  const now=Date.now();m.tokens=Math.min(90,m.tokens+Math.max(0,now-m.tokenAt)*.09)-1;m.tokenAt=now;
  if(typeof message!=='string'||message.length>2048||m.tokens<0){this.close(socket);socket.close(1008,'Invalid arena input');return;}
  let data;try{data=JSON.parse(message);}catch{return;}
  if(m.team&&data?.type==='arena-input')this.arena.input(m.id,data);
 }
 step(){
  for(const [socket,m]of this.members)if(socket.readyState!==1||!this.admitted(m.digest)||this.owner.karma.bogEntry(m.account)?.id!==m.entryId){
   this.close(socket);socket.close(1008,'Bog visit ended');
  }
  if(!this.arena.state.players.size)return;
  this.bots.step();
  this.arena.step(1/60);
  for(const p of this.exits.splice(0))this.eject(p);
  for(const p of this.arena.state.players.values()){
   if(p.bot)continue;
   const key=JSON.stringify([p.lives,p.alive,p.shieldUntil,p.respawnAt,p.out,p.dodgeReadyAt,p.speedUntil,p.hitShield,p.hitShieldUntil,p.ammo,p.reloadAt]);
   if(this.saved.get(p.id)!==key){this.persist(p);this.saved.set(p.id,key);}
  }
  if(this.arena.state.tick%3===0)this.broadcast();
 }
 close(socket){
  const m=this.members.get(socket);if(!m)return;
  if(m.team){const p=this.arena.state.players.get(m.id);if(p?.out&&!p.exited&&this.owner.karma.bogEntry(p.profile)?.id===p.entryId){p.exited=true;this.eject(p);return;}if(p)this.persist(p);this.arena.leave(m.id);this.saved.delete(m.id);}
  this.members.delete(socket);
  this.bots.sync(this.members.size>0);
  if(!this.members.size){clearInterval(this.timer);this.timer=null;}
  this.broadcast();
 }
 persist(p){
  if(p.bot)return;
  const entry=this.owner.karma.bogEntry(p.profile);if(!entry||entry.id!==p.entryId)return;
  const time=this.arena.state.time;
  const {shieldUntil,respawnAt,reloadAt,...pose}=this.arena.snapshot().players.find(q=>q.id===p.id);
  this.owner.karma.saveBogEntry(p.profile,{...entry,lives:p.lives,savedAt:Date.now(),combat:{...pose,...saveAbilityTimers(p,time),spawns:p.spawns,base:p.base,
   shieldLeft:Math.max(0,shieldUntil-time),respawnLeft:Math.max(0,respawnAt-time),reloadLeft:Math.max(0,reloadAt-time),nextFireLeft:Math.max(0,p.nextFire-time)}});
 }
 eject(p){
  const destination=bogExitIslet(),text=`Out of lives! Paddled to ${destination.name}`;
  // Move the real world actor using the same island chart and dock as landing.
  // Resume records are also moved, so losing the world socket cannot undo exit.
  for(const [socket,info]of this.owner.connections)if(info.account===p.profile&&info.actor){
   Object.assign(info.actor,{islandId:destination.islandId,x:destination.x,y:destination.y,mode:'walking',boatId:null,path:[],travel:0,pace:0,heading:null,
    action:0,until:0,jumpLeft:0,docking:false,sailTarget:null,sailRoute:null,exitLocked:false});
   Object.assign(info,{islandId:destination.islandId,input:{x:0,y:0},inputExpires:0,boarding:null,landing:null});
   this.owner.attach(socket,info);this.owner.send(socket,{type:'travel-notice',text});
  }
  const resume=this.owner.sql.exec('SELECT pose FROM resumes WHERE account=?',p.profile).toArray()[0];
  if(resume){const pose={...JSON.parse(resume.pose),islandId:destination.islandId,x:destination.x,y:destination.y,mode:'walking',boatId:null};this.owner.sql.exec('UPDATE resumes SET pose=? WHERE account=?',JSON.stringify(pose),p.profile);}
  this.owner.karma.endBogEntry(p.profile);
  for(const [socket,m]of [...this.members])if(m.account===p.profile){
   this.owner.send(socket,{type:'arena-exit',text,destination});this.close(socket);socket.close(1000,'Out of lives');
  }
  this.owner.broadcast();
 }
 dispose(){for(const socket of [...this.members.keys()])this.close(socket);}
}
