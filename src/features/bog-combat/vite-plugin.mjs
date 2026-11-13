import {installArenaSocket} from '../../../server/arena-socket.mjs';

export function bogCombatPlugin(options={}) {
  return {name:'home-island-bog-combat',apply:'serve',configureServer(server){
    if(!server.httpServer)throw new Error('Bog combat needs a Vite HTTP server');
    const room=installArenaSocket(server.httpServer,options);
    server.httpServer.once('close',()=>room.close());
  }};
}
export function arenaProxy(target='http://127.0.0.1:8891') {
  return {'/arena-room':{target,ws:true}};
}
