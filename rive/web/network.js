import {DELAY,sample} from './interpolation.js';

// The multiplayer session's 12 Hz prediction, acknowledgements and delayed
// histories, adapted to stable native Ducky instances on the island renderer.
export function installNetwork(game){
 const histories=new Map(),remotes=new Map(),pending=new Map();let socket,connected=false,stopped=false,reconnect;
 let seq=0,emoteSeq=0,lastSentAction=0,clockOffset=Infinity,snapshots=0,stateSends=0,selfId=null,offline=null,quacks={},cityBread={};
 function send(message){if(!connected||socket?.readyState!==WebSocket.OPEN||socket.bufferedAmount>4096)return false;socket.send(JSON.stringify(message));return true;}
 function dispose(d){d.sm.delete();d.vm.delete();d.art.delete();}
 function restore(){if(offline){game.ducks.splice(1,game.ducks.length-1,...offline);offline=null;}for(const d of remotes.values())dispose(d);remotes.clear();histories.clear();pending.clear();}
 function connect(){if(stopped||!game.joined)return;const params=new URLSearchParams(game.profile);socket=new WebSocket(`ws://${location.hostname}:8810/room?${params}`);
  socket.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}const now=performance.now();
   if(m.type==='welcome'){connected=true;selfId=m.self.id;seq=emoteSeq=0;lastSentAction=0;pending.clear();histories.clear();clockOffset=Infinity;
    if(!offline){offline=game.ducks.splice(1);}Object.assign(game.player,{x:m.self.x,y:m.self.y,path:[]});
    [game.camera.x,game.camera.y]=game.project(game.player.x,game.player.y);game.camera.y-=85;document.title='Ducky Land · '+game.profile.name;
   }else if(m.type==='snapshot'&&connected){snapshots++;quacks=m.quacks;cityBread=m.cityBread||{};clockOffset=Math.min(clockOffset,now-m.time);
    const all=[...m.players,...m.bots],ids=new Set(all.map(d=>d.id));
    for(const [id,d]of remotes)if(!ids.has(id)){game.ducks.splice(game.ducks.indexOf(d),1);dispose(d);remotes.delete(id);histories.delete(id);}
    for(const data of all){
     if(data.id===selfId){const p=pending.get(data.ack);if(p){const dx=data.x-p.x,dy=data.y-p.y;if(Math.hypot(dx,dy)>3){if(game.walkable(game.player.x+dx,game.player.y+dy)||game.activity?.active==='race'){game.player.x+=dx;game.player.y+=dy;}else{game.player.x=data.x;game.player.y=data.y;}for(const state of pending.values()){state.x+=dx;state.y+=dy;}}for(const n of pending.keys())if(n<=data.ack)pending.delete(n);}continue;}
     if(!remotes.has(data.id)){const d=game.createDuck(0,'plaza');Object.assign(d,{id:data.id,managed:true,player:false,turn:data.turn||0,targetTurn:data.turn||0});remotes.set(data.id,d);game.ducks.push(d);histories.set(data.id,[]);}
     const h=histories.get(data.id);h.push({...data,time:m.time});if(h.length>32)h.shift();
    }
   }
  };
  socket.onclose=()=>{connected=false;selfId=null;restore();document.title='Ducky Land · local flock';if(!stopped&&game.joined)reconnect=setTimeout(connect,1500);};
  socket.onerror=()=>{};
 }
 const actions={2:'quack',3:'dance',4:'heart',5:'laugh',6:'wave',7:'sleep',8:'angry',9:'party'};
 function emote(action){if(!actions[action])return;lastSentAction=action;send({type:'emote',action:actions[action],seq:++emoteSeq});}
 const cadence=setInterval(()=>{if(!connected||!game.joined)return;const d=game.player,packet={type:'state',seq:++seq,x:d.x,y:d.y,facing:d.facing,turn:d.turn,action:d.action===1&&!game.paused&&!game.inputLocked?1:0};if(send(packet)){pending.set(seq,{x:d.x,y:d.y});stateSends++;}if(pending.size>60)pending.delete(pending.keys().next().value);},1000/12);
 game.updateHooks.push(()=>{if(!connected)return;const action=game.player.action;if(action!==lastSentAction){if(actions[action])emote(action);else lastSentAction=action;}
  for(const [id,h]of histories){const data=sample(h,performance.now()-clockOffset-DELAY),d=remotes.get(id);if(!data)continue;Object.assign(d,{x:data.x,y:data.y,action:data.action,facing:data.facing,targetTurn:data.turn||0,name:data.name,bot:data.bot});
   for(const k of ['cap','shades','acc','shoes','city'])if(d[k]!==data[k]){d[k]=data[k];d.controls[k].value=data[k];}d.vm.string('name').value=' '+data.name+' ';
  }
 });
 game.network={get connected(){return connected;},join(profile){if(connected){send({type:'profile',...profile});return;}clearTimeout(reconnect);if(socket&&socket.readyState===WebSocket.CONNECTING)return;connect();},emote,
  startActivity(kind){pending.clear();send({type:'activity',kind});},endActivity(){pending.clear();send({type:'activity',kind:'end'});},collect(id){send({type:'collect',id});},
  inspect(){return{connected,selfId,snapshots,stateSends,hz:12,interpolationMs:DELAY,realCount:[...remotes.values()].filter(d=>!d.bot).length+(connected?1:0),botCount:[...remotes.values()].filter(d=>d.bot).length,quacks,cityBread,remoteIds:[...remotes.keys()]};},
  close(){stopped=true;clearTimeout(reconnect);clearInterval(cadence);socket?.close();}
 };
 addEventListener('pagehide',()=>game.network.close());
}
