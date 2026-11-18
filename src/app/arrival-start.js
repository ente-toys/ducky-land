import {testSession, authenticateTestSocket} from './test-session.js';
import {arrivalPending} from './arrival.js';

// Keep the page-open session check for the game, without caching later refreshes.
let session;
export function startupSession(consume = false) {
  const testing = testSession();
  if (testing) return testing;
  const pending = session ??= fetch('/api/session').then(r => {
    if (!r.ok) throw Error('Session request failed');
    return r.json();
  }).catch(error => {if (session === pending) session=undefined; throw error;});
  if (consume) session=undefined;
  return pending;
}

// Buffer the first snapshot while the renderer module downloads and evaluates.
// No player input is sent until RoomClient takes ownership.
let early;
export function startArrivalSocket(onIsland = () => {}) {
  if (early || !arrivalPending() || typeof WebSocket !== 'function') return;
  const url=new URL('/api/room?play=1&globeFeed=1',location.href);
  authenticateTestSocket(url);
  url.protocol=url.protocol==='https:'?'wss:':'ws:';
  const socket=new WebSocket(url), messages=[];
  let named=false;
  const record=event=>{
    messages.push(event);
    if (!named) {
      try {const message=JSON.parse(event.data); if(message.type==='snapshot'&&message.islandId){named=true;onIsland(message.islandId);}} catch {/* RoomClient handles the protocol once mounted. */}
    }
  };
  socket.addEventListener('message',record);
  early={socket,messages,record};
}
export function takeArrivalSocket() {
  const held=early; early=undefined;
  if (!held) return null;
  held.socket.removeEventListener('message',held.record);
  if (held.socket.readyState>1) {held.socket.close(); return null;}
  return held;
}
