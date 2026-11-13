import {walkingActor,navigationFor} from './physics.js';
import {playEmote} from '../../gameplay/player-motion.js';
import {samplePlayerTrack,displayedPlayer} from './view.js';
import {getBogBlockers} from './blockers.js';
import {BOG_COMBAT} from './config.js';
import {combatWalkStep} from './mechanics.js';

export const ARENA_INPUT_INTERVAL=1000/30;
export const ARENA_INPUT_KEEPALIVE=100;
export const ARENA_REPLACED=4001;
export function arenaCloseDetails(event={}){
  const code=event.code??1006;
  return {code,reason:event.reason||({1000:'Arena session ended',1006:'Connection interrupted before a close reason arrived'}[code]||'Arena server closed the connection')};
}

export function profileToken(storage=globalThis.localStorage){
  const key='ducky-bog-profile';let value;try{value=storage?.getItem(key);}catch{}
  if(!/^[a-zA-Z0-9_-]{32,96}$/.test(value||'')){value=crypto.randomUUID();try{storage?.setItem(key,value);}catch{}}
  return value;
}
export function arenaURL({team,name,profile},base=globalThis.location?.href||'http://localhost'){
  const url=new URL('/arena-room',base);url.protocol=url.protocol==='https:'?'wss:':'ws:';
  for(const [k,v]of Object.entries({team,name,profile})){if(v!=null)url.searchParams.set(k,v);}return url;
}
export class ArenaClient{
  constructor({team,name,profile=profileToken(),onSnapshot=()=>{},onStatus=()=>{},onExit=()=>{},Socket=WebSocket,url,schedule=setTimeout,cancel=clearTimeout,navigation,blockers=getBogBlockers(),bounds=BOG_COMBAT.bounds}={}){
    Object.assign(this,{id:null,snapshot:null,seq:0,lastSend:-Infinity,onSnapshot,onStatus,onExit});
    this.nav=navigation??(blockers===getBogBlockers()&&bounds===BOG_COMBAT.bounds?BOG_COMBAT.navigation:navigationFor(blockers,bounds));this.pending=[];this.commands=Array.from({length:120},()=>({input:{x:0,y:0,run:false}}));this.commandIndex=0;this.lastControl={};this.offsetX=this.offsetY=0;this.previous=null;this.display={};
    this.dodgeSerial=0;this.predictionInput={x:0,y:0,run:false,dodge:0};
    this.closed=false;this.tracks=new Map();this.predicted=null;this.controlled={x:0,y:0};
    Object.assign(this,{Socket,url:url||arenaURL({team,name,profile}),schedule,cancel,retries:0,retryTimer:null});
    this.connect();
  }
  connect(){
    this.id=null;this.snapshot=null;this.self=null;this.predicted=null;this.previous=null;
    this.pending.length=0;this.tracks.clear();this.seq=0;this.lastSend=-Infinity;this.lastControl={};this.offsetX=this.offsetY=0;
    this.onStatus(this.retries?'reconnecting':'connecting',this.closeDetails);
    let socket;
    try{socket=this.socket=new this.Socket(this.url);}catch(error){this.connectionClosed({code:1006,reason:error.message});return;}
    const active=()=>!this.closed&&this.socket===socket;
    socket.onmessage=({data})=>{if(!active())return;let m;try{m=JSON.parse(data);}catch{return;}
      if(m?.type==='arena-exit'){this.closed=true;if(this.retryTimer!==null)this.cancel(this.retryTimer);this.onExit(m);socket.close();return;}
      if(m?.type==='arena-welcome'){this.id=m.id;this.snapshot=null;this.tracks.clear();this.onStatus('connected');return;}
      if(m?.type!=='arena-snapshot'||!Array.isArray(m.players)||m.tick<=(this.snapshot?.tick??-1))return;
      const now=performance.now(),self=m.players.find(p=>p.id===this.id),before=this.snapshot?.players.find(p=>p.id===this.id);
      for(const p of m.players){const old=this.tracks.get(p.id);this.tracks.set(p.id,{from:old?{...this.sample(p.id,now)}:p,to:p,start:now/1000,display:{}});}
      for(const id of this.tracks.keys())if(!m.players.some(p=>p.id===id))this.tracks.delete(id);
      if(self){
        const previous=this.predicted,reset=!previous||!self.alive||before?.alive!==self.alive||Math.hypot(previous.x-self.x,previous.y-self.y)>96;
        this.predicted=walkingActor(self);this.time=m.time??0;this.dodgeSerial=Math.max(this.dodgeSerial,self.dodgeSerial??0);
        this.pending=this.pending.filter(command=>command.seq>self.ack);
        if(self.alive&&!reset)for(const command of this.pending)combatWalkStep(this.predicted,this.nav,command.dt,this.time+=command.dt,command.input);
        if(reset){this.offsetX=this.offsetY=0;this.previous=null;this.pending.length=0;}
        else {const dx=previous.x-this.predicted.x,dy=previous.y-this.predicted.y;this.offsetX+=dx;this.offsetY+=dy;if(Math.hypot(this.offsetX,this.offsetY)>90){this.offsetX=this.offsetY=0;this.previous=null;}if(this.previous){this.previous.x-=dx;this.previous.y-=dy;}}

      }
      this.self=self;this.snapshot=m;this.receivedAt=now;this.onSnapshot(m);
    };
    socket.onerror=()=>{};
    socket.onclose=event=>{if(active())this.connectionClosed(event);};
  }
  connectionClosed(event){
    this.closeDetails=arenaCloseDetails(event);this.socket=null;this.id=null;this.snapshot=null;this.self=null;this.predicted=null;
    if(this.closeDetails.code!==1000&&this.closeDetails.code!==ARENA_REPLACED&&this.retries===0){
      this.retries++;this.onStatus('reconnecting',this.closeDetails);
      this.retryTimer=this.schedule(()=>{this.retryTimer=null;if(!this.closed)this.connect();},250);
    }else this.onStatus('disconnected',this.closeDetails);
  }
  sample(id,now=performance.now()){
    const t=this.tracks.get(id);if(!t)return null;if(!t.to.alive||t.from.alive!==t.to.alive)return t.to;
    return samplePlayerTrack(t,now/1000,t.display,.05);
  }
  view(alpha=1){return this.predicted?displayedPlayer(this.predicted,this.previous,alpha,this.offsetX,this.offsetY,this.display):null;}
  queueDodge(){if(this.self?.alive)this.dodgeSerial++;}
  control(vector,facing,fire,dt,now=performance.now(),emote=null){
    const self=this.self;
    if(emote)this.queuedEmote=emote;
    const run=vector.run===true,held=!!fire;
    const changed=this.lastControl.dodge!==this.dodgeSerial||this.lastControl.x!==vector.x||this.lastControl.y!==vector.y||this.lastControl.run!==run||this.lastControl.fire!==held||this.lastControl.facing!==facing;
    const elapsed=now-this.lastSend;
    const send=this.id&&!this.closed&&this.socket.readyState===1&&elapsed+1e-7>=ARENA_INPUT_INTERVAL&&(changed||this.queuedEmote||elapsed>=ARENA_INPUT_KEEPALIVE)&&this.socket.bufferedAmount<=4096;
    if(send){this.lastSend=now;Object.assign(this.lastControl,{x:vector.x,y:vector.y,run,fire:held,facing,dodge:this.dodgeSerial});this.socket.send(JSON.stringify({type:'arena-input',seq:this.seq++,x:vector.x,y:vector.y,run,facing,fire:held,...(this.dodgeSerial?{dodge:this.dodgeSerial}:{}),...(this.queuedEmote?{emote:this.queuedEmote}:{})}));this.queuedEmote=null;}
    if(self?.alive&&this.predicted&&dt>0){
      if(!this.previous)this.previous={};this.previous.x=this.predicted.x;this.previous.y=this.predicted.y;this.previous.turn=this.predicted.turn;
      this.time=(this.time??this.snapshot.time??0)+dt;if(emote)playEmote(this.predicted,emote,this.time);
      this.predictionInput.x=vector.x;this.predictionInput.y=vector.y;this.predictionInput.run=run;this.predictionInput.dodge=this.dodgeSerial;
      combatWalkStep(this.predicted,this.nav,dt,this.time,this.predictionInput);
      const command=this.commands[this.commandIndex++%this.commands.length];if(this.pending.length===this.commands.length)this.pending.shift();
      command.seq=this.seq-1;command.dt=dt;command.input.x=vector.x;command.input.y=vector.y;command.input.run=vector.run===true;command.input.dodge=this.dodgeSerial;this.pending.push(command);
      const decay=Math.exp(-19*dt);this.offsetX*=decay;this.offsetY*=decay;
    }
  }
  dispose(){if(this.closed)return;this.closed=true;if(this.retryTimer!==null)this.cancel(this.retryTimer);this.socket?.close();this.tracks.clear();}
}

export class ArenaLobbyClient{
  constructor({profile=profileToken(),onSnapshot=()=>{},onStatus=()=>{},Socket=WebSocket,url}={}){
    this.closed=false;
    const endpoint=arenaURL({profile},globalThis.location?.href||'http://localhost');endpoint.searchParams.set('mode','lobby');
    const ws=this.socket=new Socket(url||endpoint);onStatus('connecting');
    ws.onmessage=({data})=>{if(this.closed)return;try{const m=JSON.parse(data);if(m.type==='arena-lobby'){onSnapshot(m);onStatus('connected');}}catch{}};
    ws.onerror=ws.onclose=()=>{if(!this.closed)onStatus('disconnected');};
  }
  dispose(){if(this.closed)return;this.closed=true;this.socket.close();}
}

export const BogClient=ArenaClient;
export const BogLobbyClient=ArenaLobbyClient;
