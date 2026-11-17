import {createBogCombat} from './sim.js';
import {BogCombatRoom} from './room.js';
import {createBotBrain,createBotController} from './bot-brain.js';

import {BOG_BOT_NAMES} from './rules.js';

export function demoBotCount(search){
  const raw=new URLSearchParams(search).get('bots');
  return raw&&/^\d+$/.test(raw)?Math.min(20,Math.max(0,Number(raw))):0;
}
export function createDemo(combat,count,{random=Math.random}={}){
  const sim=createBogCombat(combat),brains=new Map(),sockets=new Set();
  const heroId='bot-0';
  const {think,step:stepBots}=createBotController(sim,combat,{random,heroId});
  const metrics={cpuMs:0,maxCpuMs:0};
  for(let i=0;i<count;i++){
    const team=i%2?'evil':'karma',p=sim.join({id:`bot-${i}`,name:i===0?'Ducky':BOG_BOT_NAMES[i-1],team});
    p.bot=true;brains.set(p.id,createBotBrain(i));
  }
  class LocalSocket{
    constructor(url){this.readyState=1;this.bufferedAmount=0;sockets.add(this);const u=new URL(url);this.lobby=u.searchParams.get('mode')==='lobby';
      if(!this.lobby&&u.searchParams.has('team')){this.id='demo-player';sim.leave(this.id);sim.join({id:this.id,team:u.searchParams.get('team'),name:u.searchParams.get('name')||'You'});}
      queueMicrotask(()=>{if(this.readyState!==1)return;if(!this.lobby)this.emit({type:'arena-welcome',id:this.id??null});this.publish();});
    }
    emit(data){this.onmessage?.({data:JSON.stringify(data)});}
    publish(){if(this.lobby)this.emit({type:'arena-lobby',counts:{karma:0,evil:0},suggested:null,stats:{},medalCase:{}});else this.emit(sim.snapshot(sim.state.players.get(this.id)?.team??null));}
    send(data){const m=JSON.parse(data);if(this.id)sim.input(this.id,m);}
    close(){this.readyState=3;sockets.delete(this);if(this.id)sim.leave(this.id);}
  }
  class DemoRoom extends BogCombatRoom{
    constructor(options){super({...options,Socket:LocalSocket});this.demoSpectator=!options.team;this.demo=true;}
    step(dt,input,now=performance.now()){
      const start=performance.now();
      for(const [id,b]of brains)think(sim.state.players.get(id),b);
      stepBots();
      super.step(dt,input,now);
      sim.step(dt);
      if(sim.state.tick%3===0)for(const socket of sockets)if(socket.readyState===1)socket.publish();
      metrics.cpuMs=performance.now()-start;metrics.maxCpuMs=Math.max(metrics.maxCpuMs,metrics.cpuMs);
    }
  }
  return {sim,metrics,heroId,Room:DemoRoom,Socket:LocalSocket};
}
