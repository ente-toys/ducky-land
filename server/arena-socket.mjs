import {randomUUID} from 'node:crypto';
import {createArena} from '../src/pixi/bog-combat/sim.js';
import {teamCounts,suggestedTeam} from '../src/pixi/bog-combat/entry.js';
import {TEAMS} from '../src/pixi/bog-combat/rules.js';
import {createServer} from 'node:http';
import {WebSocketServer} from 'ws';
import {dirname} from 'node:path';
import {readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {cleanMedalCase} from '../src/pixi/bog-combat/medals.js';
import {emptyStats} from '../src/pixi/bog-combat/rules.js';

// Three times the client's 30 Hz ceiling, plus a second of burst headroom.
export const ARENA_INPUT_BURST=90,ARENA_INPUT_PER_MS=.09;

export function localArenaOrigin(origin){
  if(!origin)return true;
  try{const url=new URL(origin);return url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);}catch{return false;}
}
export function createArenaSocket(wss,profiles,{now=()=>performance.now(),combat={},log=message=>console.info(message)}={}){
  const sockets=new Map(),byProfile=new Map(),observers=new Map(),arena=createArena({...combat,onStats:(id,stats,medals)=>profiles.set(id,stats,medals)});
  const send=(ws,message)=>{if(ws.readyState===1&&ws.bufferedAmount<65536)ws.send(JSON.stringify(message));};
  const closeSocket=(ws,code,reason)=>{log(`[arena] closing code=${code} reason=${JSON.stringify(reason)}`);ws.close(code,reason);};
  function lobby(profile){const counts=teamCounts(arena.state.players.values());return {type:'arena-lobby',counts,suggested:suggestedTeam(counts),stats:profiles.get(profile),medalCase:profiles.getMedals?.(profile)||{}};}
  function remove(id){const entry=sockets.get(id);if(!entry)return;arena.leave(id);sockets.delete(id);if(byProfile.get(entry.profile)===id)byProfile.delete(entry.profile);}
  wss.on('connection',(ws,req)=>{
    ws.on('close',(code,reason)=>log(`[arena] socket closed code=${code??1006} reason=${JSON.stringify(reason?.toString()||'No close reason received')}`));
    if(!localArenaOrigin(req.headers.origin)){closeSocket(ws,1008,'Local arena only');return;}
    const params=new URL(req.url,'http://localhost').searchParams,team=params.get('team'),profile=params.get('profile');
    if((!TEAMS.includes(team)&&params.get('mode')!=='lobby')||!/^[a-zA-Z0-9_-]{32,96}$/.test(profile||'')){closeSocket(ws,1008,'Choose a team and profile');return;}
    if(params.get('mode')==='lobby'){
      const entry={profile,lastSeen:now(),alive:true};observers.set(ws,entry);send(ws,lobby(profile));
      ws.on('pong',()=>{entry.alive=true;entry.lastSeen=now();});
      ws.on('close',()=>observers.delete(ws));ws.on('error',()=>observers.delete(ws));return;
    }
    const staleId=byProfile.get(profile),stale=sockets.get(staleId);
    if(stale){remove(staleId);closeSocket(stale.ws,4001,'Arena session replaced by reconnect');}
    const id=randomUUID(),name=(params.get('name')||'Ducky').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,18)||'Ducky';
    let player;
    try{player=arena.join({id,team,name,profile,stats:profiles.get(profile),medalCase:profiles.getMedals?.(profile)});}
    catch(error){log(`[arena] ${error.message}`);closeSocket(ws,1011,'Bog environment is not ready');return;}
    if(!player){closeSocket(ws,1008,'Profile already in arena');return;}
    const entry={ws,profile,lastSeen:now(),alive:true,tokens:ARENA_INPUT_BURST,tokenAt:now()};sockets.set(id,entry);byProfile.set(profile,id);
    send(ws,{type:'arena-welcome',id,hz:60,stats:{...player.stats}});send(ws,arena.snapshot());
    ws.on('message',(buffer,binary)=>{
      if(sockets.get(id)!==entry)return;
      const time=now();entry.tokens=Math.min(ARENA_INPUT_BURST,entry.tokens+Math.max(0,time-entry.tokenAt)*ARENA_INPUT_PER_MS);entry.tokenAt=time;
      if(binary||--entry.tokens<0){remove(id);closeSocket(ws,1008,binary?'Arena input must be JSON text':'Arena input rate exceeded');return;}
      entry.lastSeen=time;let m;try{m=JSON.parse(buffer.toString());}catch{return;}
      if(m?.type==='arena-input')arena.input(id,m);
    });
    ws.on('pong',()=>{entry.alive=true;entry.lastSeen=now();});
    ws.on('close',()=>remove(id));ws.on('error',()=>remove(id));
  });
  function step(){arena.step(1/60);}
  function broadcast(){const snapshot=arena.snapshot();for(const {ws} of sockets.values())send(ws,snapshot);for(const [ws,entry]of observers)send(ws,lobby(entry.profile));}
  function heartbeat(){for(const [ws,entry]of observers){if(!entry.alive||now()-entry.lastSeen>15000){observers.delete(ws);ws.terminate();}else{entry.alive=false;ws.ping();}}for(const [id,entry]of sockets){if(!entry.alive||now()-entry.lastSeen>15000){entry.ws.terminate();remove(id);}else{entry.alive=false;entry.ws.ping();}}}
  let closed=false;
  function close(){if(closed)return;closed=true;for(const [id,{ws}]of sockets){remove(id);ws.terminate();}for(const ws of observers.keys())ws.terminate();observers.clear();profiles.flush();}
  return {arena,step,broadcast,heartbeat,close};
}

// Reusable upgrade handler for Vite or the local Home server. It claims ONLY
// /arena-room. The existing island socket and authentication remain untouched.
export function installArenaSocket(server,{profiles=createArenaProfiles(new URL('../src/pixi/bog-combat/.local/profiles.json',import.meta.url)),combat,...options}={}) {
  const wss=new WebSocketServer({noServer:true,maxPayload:2048});
  const room=createArenaSocket(wss,profiles,{combat,...options});
  const upgrade=(request,socket,head)=>{
    if(new URL(request.url,'http://localhost').pathname!=='/arena-room')return;
    wss.handleUpgrade(request,socket,head,ws=>wss.emit('connection',ws,request));
  };
  server.on('upgrade',upgrade);
  const loops=[setInterval(room.step,1000/60),setInterval(room.broadcast,50),setInterval(room.heartbeat,5000),setInterval(()=>profiles.flush(),1000)];
  loops.forEach(timer=>timer.unref?.());
  let closed=false;
  return {...room,close(){if(closed)return;closed=true;loops.forEach(clearInterval);server.off('upgrade',upgrade);room.close();wss.close();}};
}

// Optional dedicated local backend, compatible with the original /arena-room
// Vite proxy. Production deployment is intentionally not changed by this port.
export function startArenaServer({port=8891,host='127.0.0.1',...options}={}) {
  const server=createServer((request,response)=>{
    if(request.url!=='/health'){response.writeHead(404).end();return;}
    response.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({ok:true,hz:60}));
  });
  const room=installArenaSocket(server,options);server.listen(port,host);
  return {server,room,close(){room.close();server.close();}};
}

// Local arena profiles use an unguessable browser-held bearer token. The later
// authenticated entry flow can supply the account's server-resolved profile ID.
export function createArenaProfiles(file){
  if(file instanceof URL)file=fileURLToPath(file);
  let records={};try{records=JSON.parse(readFileSync(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const profiles=new Map(Object.entries(records));let dirty=false;
  const clean=value=>Object.fromEntries(Object.keys(emptyStats()).map(key=>[key,Number.isSafeInteger(value?.[key])&&value[key]>=0?value[key]:0]));
  return {
    get:id=>clean(profiles.get(id)),
    getMedals:id=>cleanMedalCase(profiles.get(id)?.medalCase),
    set(id,value,medalCase=profiles.get(id)?.medalCase){profiles.set(id,{...clean(value),medalCase:cleanMedalCase(medalCase)});dirty=true;},
    flush(){if(!dirty)return;mkdirSync(dirname(file),{recursive:true});const temporary=file+`.${process.pid}.tmp`;writeFileSync(temporary,JSON.stringify(Object.fromEntries(profiles)),{mode:0o600});renameSync(temporary,file);dirty=false;},
  };
}
