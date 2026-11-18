// The sled hill's live game room, owned by the IslandRoom like the Bog arena. Anyone walking near the sled hill on the
// snow island connects and watches the lobby (for the waiting sign and the pop-up) and the race on the island's own
// run; joining takes a seat. The lobby (src/features/sled-race/lobby.js) decides when to race and runs the race.
import {createSledLobby} from '../src/features/sled-race/lobby.js';
import {buildCourse} from '../src/features/sled-race/course.js';
import {raceAchievements} from '../src/features/sled-race/achievements.js';
import {SLED,SLED_ISLAND,SLED_ZONE,SLED_WATCH_RADIUS} from '../src/features/sled-race/rules.js';
import {landingSpot} from '../src/features/sled-race/hill.js';
import {mapOf} from '../src/world/island-maps.js';

const LOST_GRACE_MS=10_000;
const emptyStats=()=>({races:0,wins:0,podiums:0,streak:0,best:null,medals:[]});

export class LiveSledRoom {
 constructor(owner){
  this.owner=owner;this.members=new Map();this.lobby=createSledLobby();this.ticks=0;this.last='';
  owner.sql.exec('CREATE TABLE IF NOT EXISTS sled_profiles (account TEXT PRIMARY KEY, stats TEXT NOT NULL)');
 }
 profile(account){
  const row=this.owner.sql.exec('SELECT stats FROM sled_profiles WHERE account=?',account).toArray()[0];
  return row?{...emptyStats(),...JSON.parse(row.stats)}:emptyStats();
 }
 // Walking on the snow island close to the sled hill; a seated racer may stay connected wherever its duck is parked.
 admitted(digest,{seated=false}={}){
  const user=this.owner.session(digest);
  const info=user?.canPlay&&[...this.owner.connections.values()].find(i=>i.account===user.account&&i.actor);
  const p=info?.actor;
  if(p?.islandId!==SLED_ISLAND||p.mode!=='walking')return null;
  if(seated)return {user,info};
  const hill=mapOf(SLED_ISLAND).world.zones[SLED_ZONE];
  return Math.hypot(p.x-hill.x,p.y-hill.y)<=SLED_WATCH_RADIUS?{user,info}:null;
 }
 open(socket,{digest}){
  const allowed=this.admitted(digest,{seated:this.lobby.seats.has(this.owner.session(digest)?.account)});
  if(!allowed)return false;
  const {user,info}=allowed,account=user.account;
  for(const [peer,m]of this.members)if(m.account===account){this.members.delete(peer);peer.close(4001,'Sled session replaced by reconnect');}
  this.members.set(socket,{digest,account,name:user.login,tokens:60,tokenAt:Date.now()});
  socket.serializeAttachment({sled:{digest}});
  this.owner.send(socket,{type:'sled-welcome',id:account,hz:SLED.hz,profile:this.profile(account)});
  this.broadcast();
  if(!this.timer){this.timer=setInterval(()=>this.step(),1000/SLED.hz);this.timer.unref?.();}
  return true;
 }
 message(socket,message){
  const m=this.members.get(socket);if(!m)return;
  const now=Date.now();m.tokens=Math.min(60,m.tokens+Math.max(0,now-m.tokenAt)*.06)-1;m.tokenAt=now;
  if(typeof message!=='string'||message.length>512||m.tokens<0){this.close(socket);socket.close(1008,'Invalid sled input');return;}
  let data;try{data=JSON.parse(message);}catch{return;}
  if(data?.type==='sled-input')this.lobby.input(m.account,{steer:Number(data.steer)||0,tuck:Boolean(data.tuck),jump:Boolean(data.jump)});
  else if(data?.type==='sled-join')this.join(socket,m);
  else if(data?.type==='sled-ready'){this.lobby.ready(m.account,data.ready!==false);this.broadcast();}
  else if(data?.type==='sled-leave'){this.quit(m.account);this.broadcast();}
 }
 // take a seat; the duck stops where it stands while it waits and races
 join(socket,m){
  const info=[...this.owner.connections.values()].find(i=>i.account===m.account&&i.actor);
  const joined=this.lobby.join(m.account,{name:m.name,outfit:info?.actor.outfit??null});
  if(!joined.ok){this.owner.send(socket,{type:'sled-busy',reason:joined.reason});return false;}
  if(info){Object.assign(info,{input:{x:0,y:0},inputExpires:0});Object.assign(info.actor,{path:[],pace:0,heading:null});}
  this.broadcast();return true;
 }
 step(){
  // a player who leaves the snow island is let go, after a short grace for a dropped island connection
  const now=Date.now();
  for(const [socket,m]of this.members){
   if(socket.readyState===1&&this.admitted(m.digest,{seated:true})){m.lostAt=null;continue;}
   m.lostAt??=now;
   if(socket.readyState!==1||now-m.lostAt>LOST_GRACE_MS){this.close(socket);socket.close(1008,'Sled visit ended');}
  }
  const happened=this.lobby.tick(Date.now()/1000),events=this.lobby.drainEvents();
  if(happened.started)this.board();
  if(happened.finished){this.finish(happened.finished);this.land(happened.finished.standings);}
  this.ticks++;
  const racing=this.lobby.phase==='racing';
  // during a race at SLED.hz/SLED.broadcastEvery (with the race's events), otherwise whenever the lobby changes
  if(racing?this.ticks%SLED.broadcastEvery===0||events.length:happened.started||this.changed())this.broadcast(events);
  else if(events.length)this.pending=[...(this.pending??[]),...events];
  if(!this.members.size&&this.lobby.phase==='empty'){clearInterval(this.timer);this.timer=null;}
 }
 changed(){const key=JSON.stringify([this.lobby.phase,Math.ceil(this.lobby.snapshot().endsAt),this.lobby.snapshot().seats]);if(key===this.last)return false;this.last=key;return true;}
 broadcast(events=[]){
  const all=[...(this.pending??[]),...events];this.pending=null;
  const message={type:'sled-state',now:Date.now()/1000,...this.lobby.snapshot(),events:all};
  for(const socket of this.members.keys())this.owner.send(socket,message);
 }
 // is this account in the race being run right now?
 racing(account){return this.lobby.racers.some(r=>r.id===account);}
 // the island duck of every racer leaves the island while it races (everyone nearby sees it on the hill instead)
 duck(account){for(const [socket,info]of this.owner.connections)if(info.account===account&&info.actor)return {socket,info};return null;}
 move(account,changes){
  const duck=this.duck(account);if(!duck)return false;
  Object.assign(duck.info,{input:{x:0,y:0},inputExpires:0});Object.assign(duck.info.actor,{path:[],pace:0,heading:null,...changes});
  this.owner.attach(duck.socket,duck.info);return true;
 }
 board(){
  for(const r of this.lobby.racers)if(!r.bot)this.move(r.id,{sledding:true});
  this.owner.broadcast();
 }
 // and comes back on the plaza below the finish line
 land(standings){
  let other=0;
  for(const r of standings){
   if(r.bot||!this.duck(r.id)?.info.actor.sledding)continue;
   const spot=landingSpot(other++);
   this.move(r.id,{sledding:false,x:spot.x,y:spot.y});
  }
  this.owner.broadcast();
 }
 // leaving the seat (or the room) mid-race puts the duck back on the runout
 quit(account){
  this.lobby.leave(account);
  if(this.duck(account)?.info.actor.sledding){const spot=landingSpot(0);this.move(account,{sledding:false,x:spot.x,y:spot.y});this.owner.broadcast();}
 }
 // stats and medals for every person in the race; each gets their own medals
 finish(results){
  const course=buildCourse(results.seed);
  for(const r of results.standings){
   if(r.bot)continue;
   const stats=this.profile(r.id),won=r.place===1&&results.standings.length>1;
   const medals=raceAchievements({me:{...r,finishedAt:r.time},course,standings:results.standings,history:stats}).map(a=>a.id);
   const next={races:stats.races+1,wins:stats.wins+(won?1:0),podiums:stats.podiums+(r.place<=3?1:0),streak:won?stats.streak+1:0,
    best:r.dnf?stats.best:Math.min(stats.best??Infinity,r.time),medals:[...new Set([...stats.medals,...medals])]};
   this.owner.sql.exec('INSERT OR REPLACE INTO sled_profiles VALUES(?,?)',r.id,JSON.stringify(next));
   for(const [socket,m]of this.members)if(m.account===r.id)this.owner.send(socket,{type:'sled-medals',medals,profile:next});
  }
 }
 close(socket){
  const m=this.members.get(socket);if(!m)return;
  this.members.delete(socket);
  if(![...this.members.values()].some(o=>o.account===m.account))this.quit(m.account);
  this.broadcast();
 }
 dispose(){for(const socket of [...this.members.keys()])this.close(socket);clearInterval(this.timer);this.timer=null;}
}
