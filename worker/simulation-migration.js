import {ISLANDS} from '../src/gameplay/islands.js';
import {BOG_ISLAND} from '../src/features/bog-combat/entry.js';
import {simulationStub, internalPost} from '../server/simulation-routing.js';

const owners = [...ISLANDS.map((i) => i.id), 'sea'];
const day = 86400000;
const list = (room, table) => room.sql.exec('SELECT * FROM ' + table).toArray();
const has = (room, table) =>
  room.sql.exec("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", table).toArray().length;
const rejected = (text) => new Response(text, {status: 409});

const kinds = ['players', 'boats', 'profiles', 'visits'];
function storeSnapshot(room, name, data) {
  room.sql.exec(
    'CREATE TABLE IF NOT EXISTS migration_records (name TEXT,kind TEXT,ordinal INTEGER,record TEXT,PRIMARY KEY(name,kind,ordinal))'
  );
  room.ctx.storage.transactionSync(() => {
    room.sql.exec('DELETE FROM migration_records WHERE name=?', name);
    for (const kind of kinds)
      for (const [ordinal, value] of data[kind].entries())
        room.sql.exec(
          'INSERT INTO migration_records VALUES(?,?,?,?)',
          name,
          kind,
          ordinal,
          JSON.stringify(value)
        );
  });
}
function readSnapshot(room, name) {
  const snapshot = {players: [], boats: [], profiles: [], visits: []};
  for (const {kind, record} of room.sql.exec(
    'SELECT kind,record FROM migration_records WHERE name=? ORDER BY kind,ordinal',
    name
  ))
    snapshot[kind].push(JSON.parse(record));
  return snapshot;
}

export function freeze(room) {
  clearInterval(room.timer);
  room.timer = null;
  clearTimeout(room.presenceTimer);
  room.presenceTimer = null;
  clearInterval(room.globeTimer);
  room.globeTimer = null;
  room.bog?.dispose();
  room.saveBoats();
  const players = new Map(
    list(room, 'resumes')
      .filter((row) => row.expires > Date.now())
      .map((row) => [row.account, row])
  );
  for (const row of list(room, 'room_checkpoints'))
    players.set(row.account, {...row, expires: Date.now() + day});
  return {
    players: [...players.values()].map(({account, pose, expires}) => ({account, pose, expires})),
    boats: room.boats,
    profiles: has(room, 'bog_profiles') ? list(room, 'bog_profiles') : [],
    visits: list(room, 'bog_entries'),
  };
}

function checkUnique(items, id, label) {
  if (new Set(items.map(id)).size !== items.length) throw Error('Duplicate ' + label + ' in migration');
}
function validate(data) {
  checkUnique(data.players, (p) => p.account, 'account');
  checkUnique(data.boats, (b) => b.id, 'boat');
  const actors = new Map(
    data.players.map((p) => {
      const pose = JSON.parse(p.pose);
      return [pose.id, pose];
    })
  );
  checkUnique([...data.players.map((p) => JSON.parse(p.pose))], (p) => p.id, 'actor');
  for (const boat of data.boats) {
    if (boat.occupant && actors.get(boat.occupant)?.boatId !== boat.id)
      throw Error('Unmatched boat occupant');
  }
  const boats = new Map(data.boats.map((b) => [b.id, b]));
  for (const actor of actors.values())
    if (actor.mode === 'sailing' && boats.get(actor.boatId)?.occupant !== actor.id)
      throw Error('Unmatched sailing actor');
}

async function checksum(data) {
  const canonical = (value) =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])])
          )
        : value;
  const rows = kinds.map((kind) => data[kind].map((row) => JSON.stringify(canonical(row))).sort());
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(rows)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function replaceGameplay(room, data) {
  room.sql.exec(
    'DELETE FROM resumes; DELETE FROM room_checkpoints; DELETE FROM boats; DELETE FROM boat_states;'
  );
  for (const b of data.boats) room.sql.exec('INSERT INTO boat_states VALUES(?,?)', b.id, JSON.stringify(b));
  for (const p of data.players)
    room.sql.exec('INSERT INTO resumes VALUES(?,?,?)', p.account, p.pose, p.expires);
  room.sql.exec(
    'CREATE TABLE IF NOT EXISTS bog_profiles (account TEXT PRIMARY KEY,stats TEXT NOT NULL,medals TEXT NOT NULL); DELETE FROM bog_profiles; DELETE FROM bog_entries;'
  );
  for (const p of data.profiles)
    room.sql.exec('INSERT INTO bog_profiles VALUES(?,?,?)', p.account, p.stats, p.medals);
  for (const v of data.visits) room.sql.exec('INSERT INTO bog_entries VALUES(?,?)', v.account, v.state);
  room.boats = data.boats;
  room.savedBoatRows = new Map(data.boats.map((b) => [b.id, JSON.stringify(b)]));
  room.savedCheckpointRows.clear();
  room.karma.bogEntries.clear();
}

export async function migrateWorld(room, {id, world, target}) {
  if (
    !id ||
    !['legacy', 'split'].includes(target) ||
    !world ||
    room.env.ISLAND.idFromName(world).toString() !== room.ctx.id.toString()
  )
    return rejected('Invalid migration');
  return room.ctx.blockConcurrencyWhile(async () => {
    const kv = room.ctx.storage.kv;
    room.sql.exec(
      'CREATE TABLE IF NOT EXISTS finished_migrations (id TEXT PRIMARY KEY,target TEXT NOT NULL)'
    );
    const previous = kv.get('migration');
    if (
      previous?.id !== id &&
      room.sql.exec('SELECT 1 FROM finished_migrations WHERE id=?', id).toArray().length
    )
      return rejected('Migration superseded');
    if (previous?.id === id && previous.target !== target) return rejected('Migration ID reused');
    if (previous?.id === id && previous.done) return Response.json(previous);
    if (previous && !previous.done && previous.id !== id) {
      if (previous.target === 'split' && target === 'legacy' && room.settings?.mode === 'maintenance') {
        const source = readSnapshot(room, 'migration-source');
        if (!source) return rejected('Missing legacy checkpoint');
        room.ctx.storage.transactionSync(() => {
          replaceGameplay(room, source);
          room.sql.exec(
            'INSERT OR REPLACE INTO finished_migrations VALUES(?,?),(?,?)',
            previous.id,
            previous.target,
            id,
            target
          );
          room.sql.exec("UPDATE world_settings SET mode='legacy' WHERE id=1");
          room.settings = {world, mode: 'legacy'};
          kv.put('migration', {id, target, done: true});
        });
        return Response.json({id, target, done: true});
      }
      return rejected('Resume the current migration ID');
    }
    const mode = room.settings?.mode ?? 'legacy';
    if (mode === target) return rejected('Already using requested layout');
    const setMode = (mode) => {
      room.sql.exec('INSERT OR REPLACE INTO world_settings VALUES(1,?,?)', world, mode);
      room.settings = {world, mode};
    };
    const migration = {
      id,
      target,
      done: false,
      generation: previous?.id === id ? previous.generation : Date.now(),
    };
    if (!previous || previous.id !== id) {
      if (
        room.sql.exec("SELECT id FROM simulation_transfers WHERE state='prepared' LIMIT 1").toArray().length
      )
        return rejected('Travel in progress');
      room.ctx.storage.transactionSync(() => {
        if (target === 'split') storeSnapshot(room, 'migration-source', freeze(room));
        kv.put('migration', migration);
        setMode('maintenance');
      });
      for (const socket of room.ctx.getWebSockets()) {
        room.send(socket, {type: 'travel-notice', text: 'The world is updating. Reload this tab to rejoin.'});
        socket.close(1012, 'World updated. Reload to rejoin.');
      }
      room.connections.clear();
    }
    const call = async (owner, path, payload) => {
      const r = await internalPost(simulationStub(room.env, world, owner), path, payload);
      if (!r.ok) throw Error('Migration ' + path + ' failed for ' + owner);
      return r.json();
    };
    if (target === 'split') {
      const data = readSnapshot(room, 'migration-source');
      validate(data);
      const ownerForPlayer = (row) => {
        const pose = JSON.parse(row.pose);
        return pose.mode === 'sailing' ? 'sea' : pose.islandId;
      };
      const ownerForBoat = (boat) => (boat.occupant ? 'sea' : boat.islandId);
      if (
        data.players.some((p) => !owners.includes(ownerForPlayer(p))) ||
        data.boats.some((b) => !owners.includes(ownerForBoat(b)))
      )
        throw Error('Migration contains an unknown destination');
      room.sql.exec('DELETE FROM simulation_owners; DELETE FROM simulation_transfers;');
      for (const owner of owners) {
        const players = data.players.filter((row) => ownerForPlayer(row) === owner);
        const part = {
          players: players.map((p) => ({...p, expires: Number.MAX_SAFE_INTEGER})),
          boats: data.boats.filter((b) => ownerForBoat(b) === owner),
          profiles: owner === BOG_ISLAND ? data.profiles : [],
          visits: owner === BOG_ISLAND ? data.visits : [],
        };
        const expected = await checksum(part);
        const result = await call(owner, '/migration/import', {id, data: part});
        if (result.checksum !== expected) throw Error('Import mismatch for ' + owner);
        for (const p of players)
          room.sql.exec(
            `INSERT INTO simulation_owners VALUES(?,?,?)
          ON CONFLICT(account) DO UPDATE SET owner=excluded.owner`,
            p.account,
            owner,
            migration.generation
          );
      }
    } else {
      const data = {players: [], boats: [], profiles: [], visits: []};
      for (const owner of owners) {
        const committed = room.sql
          .exec(
            `SELECT t.id FROM simulation_transfers t JOIN simulation_owners o
          ON t.account=o.account AND t.destination=o.owner AND t.generation+1=o.generation
          WHERE o.owner=? AND t.state='committed'`,
            owner
          )
          .toArray()
          .map((t) => t.id);
        const relinquished = room.sql
          .exec("SELECT id FROM simulation_transfers WHERE source=? AND state='committed'", owner)
          .toArray()
          .map((t) => t.id);
        const part = await call(owner, '/migration/export', {id, committed, relinquished});
        for (const k of Object.keys(data)) data[k].push(...part[k]);
      }
      validate(data);
      for (const p of data.players) p.expires = Date.now() + day;
      room.ctx.storage.transactionSync(() => replaceGameplay(room, data));
    }
    room.ctx.storage.transactionSync(() => {
      setMode(target);
      kv.put('migration', {...migration, done: true});
      room.sql.exec('INSERT OR REPLACE INTO finished_migrations VALUES(?,?)', id, target);
    });
    return Response.json({...migration, done: true});
  });
}

export async function localMigration(room, path, {id, data, committed = [], relinquished = []}) {
  const kv = room.ctx.storage.kv;
  if (path === '/migration/import') {
    if (kv.get('last-import') !== id) {
      room.ctx.storage.transactionSync(() => {
        replaceGameplay(room, data);
        room.sql.exec('DELETE FROM incoming; DELETE FROM outgoing;');
        kv.put('last-import', id);
        kv.delete('frozen');
      });
    }
    const persisted = {
      players: list(room, 'resumes'),
      boats: list(room, 'boat_states').map((row) => JSON.parse(row.state)),
      profiles: list(room, 'bog_profiles'),
      visits: list(room, 'bog_entries'),
    };
    return Response.json({checksum: await checksum(persisted)});
  }
  if (!kv.get('frozen')) {
    const snapshot = freeze(room);
    for (const row of list(room, 'outgoing')) {
      if (relinquished.includes(row.id)) continue;
      const item = JSON.parse(row.payload);
      const actor = item.before?.actor ?? item.actor,
        boat = item.before?.boat ?? item.boat;
      snapshot.players.push({account: item.account, pose: JSON.stringify(actor), expires: Date.now() + day});
      if (boat) snapshot.boats.push(boat);
    }
    for (const row of list(room, 'incoming')) {
      if (!committed.includes(row.id)) continue;
      const {actor, boat} = JSON.parse(row.payload);
      snapshot.players.push({account: row.account, pose: JSON.stringify(actor), expires: Date.now() + day});
      if (boat) snapshot.boats.push(boat);
    }
    storeSnapshot(room, 'frozen-state', snapshot);
    kv.put('frozen', true);
    for (const socket of room.ctx.getWebSockets()) socket.close(1012, 'World maintenance');
    room.connections.clear();
  }
  return Response.json(readSnapshot(room, 'frozen-state'));
}
