import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import test from 'node:test';
import {SAIL_SPEED} from '../src/gameplay/islands.js';

test('40 sailing players resume the same boats and saved positions after a Worker preview restart', {timeout: 60_000}, async t => {
  const storage = await mkdtemp(join(tmpdir(), 'ducky-room-restart-'));
  let preview;
  t.after(async () => {
    try { await preview?.dispose(); }
    finally { await rm(storage, {recursive: true, force: true}); }
  });

  const {outputFiles:[bundle]} = await build({
    stdin:{resolveDir:new URL('..', import.meta.url).pathname, contents:`
      import {IslandRoom} from './worker/index.js';
      import {canSail} from './src/gameplay/islands.js';
      export class PreviewIsland extends IslandRoom {
        saveBoats(...args) {
          super.saveBoats(...args);
          if (this.sailingCheckpoints !== undefined) this.sailingCheckpoints++;
        }

        async fetch(request) {
          const path = new URL(request.url).pathname;
          if (path === '/fixture/fleet') {
            const spots = [];
            for (let y = -5000; y <= 6500 && spots.length < 40; y += 1150) {
              for (let x = -1200; x <= 10500 && spots.length < 40; x += 1150) {
                if (canSail(x, y, 'home', 200) && canSail(x+600, y, 'home', 180)) spots.push({x,y});
              }
            }
            let i = 0;
            for (const info of this.connections.values()) {
              if (!info.actor) continue;
              const id = 'home-0~preview-' + i;
              const point = spots[i++];
              const boat = {id, ...point, islandId:'home', departure:'home', turn:0, occupant:info.actor.id, owner:info.account};
              this.boats.push(boat);
              Object.assign(info.actor, point, {mode:'sailing', boatId:id, path:[]});
            }
            this.saveBoats();
            this.sailingCheckpoints = 0;
            this.stepsAtLaunch = this.stepCount ?? 0;
            this.broadcast();
            return Response.json(spots);
          }
          if (path === '/fixture/before-restart') {
            const current = [];
            for (const info of this.connections.values()) {
              if (info.actor) {
                const {id,x,y,travel} = info.actor;
                current.push({id,x,y,travel});
              }
            }
            this.interrupting = true;
            if (this.timer) { clearInterval(this.timer); this.timer = null; }
            const checkpoints = this.sql.exec('SELECT pose FROM room_checkpoints').toArray().map(row => JSON.parse(row.pose));
            const resumes = this.sql.exec('SELECT count(*) AS count FROM resumes').one().count;
            return Response.json({current, checkpoints, resumes,
              sailingSteps:this.stepCount-this.stepsAtLaunch, sailingCheckpoints:this.sailingCheckpoints});
          }
          return super.fetch(request);
        }

        webSocketClose(socket, code, reason, wasClean) {
          // Model an abrupt reset, where the old instance cannot commit a final pose from its close callback.
          if (!this.interrupting) super.webSocketClose(socket, code, reason, wasClean);
        }
      }
      export default {fetch(request, env) {
        return env.ISLAND.get(env.ISLAND.idFromName('recovery-preview')).fetch(request);
      }};
    `}, bundle:true, write:false, format:'esm',
  });

  async function start() {
    preview = new Miniflare(convertV4MiniflareOptions({
      modules:[{type:'ESModule',path:'index.js',contents:bundle.text}],
      compatibilityDate:'2026-11-02',
      durableObjects:{ISLAND:{className:'PreviewIsland',useSQLite:true}},
      resourcePersistencePath:storage,
    }));
    await preview.ready;
  }
  const request = (path, options) => preview.dispatchFetch('https://room.preview'+path, options);
  async function joinRoom(digest, resume) {
    const query = new URLSearchParams({play:'1'});
    if (resume) query.set('resume', resume);
    const result = await request('/room?'+query, {headers:{Upgrade:'websocket','X-Session-Digest':digest}});
    assert.equal(result.status, 101);
    const socket = result.webSocket;
    const state = {socket,digest,seq:0};
    socket.addEventListener('message', ({data}) => {
      if (data === 'pong') return;
      const message = JSON.parse(data);
      if (message.type === 'welcome') state.id = message.id;
      else if (message.type === 'snapshot') state.snapshot = message;
    });
    socket.accept();
    for (let n = 0; n < 100 && !state.snapshot; n++) await delay(10);
    assert.ok(state.id && state.snapshot, 'player receives welcome and snapshot');
    return state;
  }

  await start();
  const players = [];
  for (let i = 0; i < 40; i++) {
    const digest = 'sailing-preview-'+i;
    const session = await request('/session/new', {
      method:'POST', body:JSON.stringify({digest,account:digest,login:digest,canPlay:true,githubToken:null}),
    });
    assert.equal(session.status, 200);
    players.push(await joinRoom(digest));
  }
  const starts = await (await request('/fixture/fleet')).json();
  assert.equal(starts.length, 40);
  for (let i = 0; i < 12; i++) {
    for (const player of players) {
      player.socket.send(JSON.stringify({type:'input',islandId:'home',seq:++player.seq,x:1,y:0}));
    }
    await delay(120);
  }
  const saved = await (await request('/fixture/before-restart')).json();
  assert.equal(saved.resumes, 0, 'no close callback wrote resume rows');
  assert.equal(saved.checkpoints.length, 40);
  assert.equal(saved.current.length, 40);
  assert.ok(saved.sailingCheckpoints > 0 && saved.sailingCheckpoints < saved.sailingSteps / 2,
    'moving boats are checkpointed less often than the simulation runs');
  for (const [index, pose] of saved.current.entries()) {
    assert.ok(pose.travel > 0 || Math.hypot(pose.x-starts[index].x, pose.y-starts[index].y) > 50,
      'every player sailed before the reset');
  }

  const epoch = players[0].snapshot.epoch;
  await preview.dispose();
  await start();
  let maxRollback = 0;
  for (const player of players) {
    const restored = await joinRoom(player.digest, player.id);
    assert.equal(restored.id, player.id);
    assert.notEqual(restored.snapshot.epoch, epoch, 'a new room instance served the reconnect');
    const pose = restored.snapshot.players.find(p => p.id === player.id);
    const checkpoint = saved.checkpoints.find(p => p.id === player.id);
    const latest = saved.current.find(p => p.id === player.id);
    const boat = restored.snapshot.boats.find(b => b.id === pose.boatId);
    assert.equal(pose.mode, 'sailing');
    assert.equal(pose.islandId, 'home');
    assert.equal(pose.boatId, checkpoint.boatId);
    assert.equal(boat.occupant, player.id);
    assert.ok(Math.hypot(pose.x-checkpoint.x, pose.y-checkpoint.y) < .02);
    assert.ok(Math.hypot(pose.x-boat.x, pose.y-boat.y) < .02);
    maxRollback = Math.max(maxRollback, Math.hypot(pose.x-latest.x, pose.y-latest.y));
  }
  assert.ok(maxRollback <= SAIL_SPEED * 1.1, 'rollback stays within the one-second checkpoint budget plus tick allowance');
  t.diagnostic(`40/40 sailing positions and boats restored; largest rollback before reconnect was ${maxRollback.toFixed(2)} world units`);
});
