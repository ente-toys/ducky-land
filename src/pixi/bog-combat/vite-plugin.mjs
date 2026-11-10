import {installArenaSocket} from '../../../server/arena-socket.mjs';

// Include bogCombatPlugin({combat:{navigation,pads,blockers,bounds}}) in the
// existing Vite config after the environment merge. It shares the same HTTP port.
export function bogCombatPlugin(options={}) {
  return {name:'home-island-bog-combat',apply:'serve',configureServer(server){
    if(!server.httpServer)throw new Error('Bog combat needs a Vite HTTP server');
    const room=installArenaSocket(server.httpServer,options);
    server.httpServer.once('close',()=>room.close());
  }};
}
// Alternative for a dedicated backend. Merge into server.proxy, preserving /api.
export function arenaProxy(target='http://127.0.0.1:8891') {
  return {'/arena-room':{target,ws:true}};
}
