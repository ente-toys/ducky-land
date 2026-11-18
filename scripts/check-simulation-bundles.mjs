// Exercise separately bundled Pages and Worker scripts with real cross-script DO bindings.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {RUN_SPEED} from '../src/gameplay/player-motion.js';

const [pagesFile, workerFile] = process.argv.slice(2);
assert.ok(pagesFile && workerFile, 'Pass the Wrangler-built Pages and room Worker files');
const [pagesBundle, workerBundle] = await Promise.all(
  [pagesFile, workerFile].map((path) => readFile(path, 'utf8'))
);
const classes = {
  ISLAND: 'IslandRoom',
  ISLAND_SIM: 'IslandSimulation',
  SEA_SIM: 'SeaSimulation',
  WORLD_PRESENCE: 'WorldPresence',
};
const bindings = (scriptName) =>
  Object.fromEntries(
    Object.entries(classes).map(([name, className]) => [
      name,
      {className, useSQLite: true, ...(scriptName && {scriptName})},
    ])
  );
const config = {compatibilityDate: '2026-11-02', compatibilityFlags: ['nodejs_compat']};
const world = 'bundle-check';
function pages(name, worldName) {
  return {
    ...config,
    name,
    routes: [name + '.local.test/*'],
    modules: [{type: 'ESModule', path: 'pages.js', contents: pagesBundle}],
    durableObjects: bindings('room'),
    bindings: {ISLAND_ROOM_NAME: worldName, WORLD_LAYOUT: 'split', WORLD_MIGRATION_ID: 'first-cutover'},
  };
}
// Only this local wrapper exposes fault injection on the internal binding.
const wrapper = `
  import {IslandSimulation as Base} from './room.js';
  export {default,IslandRoom,SeaSimulation,WorldPresence} from './room.js';
  export class IslandSimulation extends Base {
    fetch(request) {
      if(new URL(request.url).pathname==='/fixture/restart') this.ctx.abort('Home restart rehearsal');
      return super.fetch(request);
    }
  }`;
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      pages('pages', world),
      pages('other', 'other-world'),
      {
        ...config,
        name: 'room',
        modules: [
          {type: 'ESModule', path: 'fixture.js', contents: wrapper},
          {type: 'ESModule', path: 'room.js', contents: workerBundle},
        ],
        durableObjects: bindings(),
      },
    ],
  })
);
const sockets = [];
const origin = 'https://pages.local.test';
async function until(read) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const value = read();
    if (value) return value;
    await delay(20);
  }
  assert.fail('Timed out waiting for a room message');
}
async function open(site, query) {
  const response = await runtime.dispatchFetch(site + '/api/room?protocol=2&globeFeed=1&' + query, {
    headers: {Origin: site, Upgrade: 'websocket'},
  });
  assert.equal(response.status, 101, response.status === 101 ? '' : await response.text());
  const socket = response.webSocket,
    messages = [];
  sockets.push(socket);
  socket.addEventListener('message', ({data}) =>
    messages.push(data === 'pong' ? {type: 'pong'} : JSON.parse(data))
  );
  socket.accept();
  const first = await until(() => messages.find((m) => m.type === 'snapshot'));
  return {socket, messages, first, welcome: messages.find((m) => m.type === 'welcome')};
}
try {
  const response = await runtime.dispatchFetch(origin + '/api/test-session', {
    method: 'POST',
    headers: {Origin: origin, 'X-Multiplayer-Test-Id': '919c4104-faed-4a20-931c-9b3abec359ab'},
  });
  assert.equal(response.status, 200);
  const {token} = await response.json();
  const home = await open(origin, 'play=1&testSession=' + token);
  const actor = home.welcome.id;
  assert.ok(actor);
  const quiet = await open(origin, 'play=0&watch=blossom');
  const other = await open('https://other.local.test', 'play=0&watch=home');
  assert.deepEqual(other.first.players, []);
  const initial = home.first.players.find((p) => p.id === actor);
  for (let seq = 1; seq <= 14; seq++) {
    home.socket.send(JSON.stringify({type: 'input', seq, x: 1, y: 0, run: true}));
    await delay(100);
  }
  const previous = home.messages
    .filter((m) => m.type === 'snapshot')
    .at(-1)
    .players.find((p) => p.id === actor);
  assert.ok(Math.hypot(previous.x - initial.x, previous.y - initial.y) > 0);
  const islands = await runtime.getDurableObjectNamespace('ISLAND_SIM', 'room');
  const object = islands.get(islands.idFromName(JSON.stringify([world, 'home'])));
  await assert.rejects(object.fetch('https://island.internal/fixture/restart'), /Home restart rehearsal/);
  const recovered = await open(origin, 'play=1&testSession=' + token + '&resume=' + actor);
  assert.equal(recovered.welcome.id, actor);
  assert.notEqual(recovered.first.epoch, home.first.epoch);
  const pose = recovered.first.players.find((p) => p.id === actor);
  const rollback = Math.hypot(pose.x - previous.x, pose.y - previous.y);
  assert.ok(rollback <= RUN_SPEED, 'movement rollback within one second of running');
  const joining = await open(origin, 'play=0&watch=blossom');
  assert.equal(joining.first.epoch, quiet.first.epoch);
  assert.equal(joining.first.islandId, 'blossom');
  quiet.socket.send('ping');
  await until(() => quiet.messages.some((m) => m.type === 'pong'));
  assert.equal(other.socket.readyState, 1);
  console.log(
    JSON.stringify({
      homeRestarted: true,
      quietIslandJoin: true,
      quietObserverConnected: true,
      actorRecovered: true,
      rollbackWorldUnits: rollback,
    })
  );
} finally {
  for (const socket of sockets) if (socket.readyState === 1) socket.close();
  await runtime.dispose();
}
