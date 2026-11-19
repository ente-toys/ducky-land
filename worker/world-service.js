import {IslandRoom as LegacyRoom} from './index.js';
import {migrateWorld} from './simulation-migration.js';
import {OwnershipDirectory} from './ownership.js';
import {presenceStub, simulationStub, internalPost} from '../server/simulation-routing.js';
import {islandFor, near} from '../src/gameplay/islands.js';
import {BOG_ISLAND} from '../src/features/bog-combat/entry.js';
import {TELEPORTERS, teleportPrice} from '../src/gameplay/teleport.js';
import {randomOutfit} from '../src/gameplay/outfits.js';
import {pickSpawnIsland} from '../src/gameplay/world-spawn.js';
import {FRIEND_RADIUS} from '../src/multiplayer/friends.js';

const fail = (status = 409) => new Response(null, {status});
export class WorldService extends LegacyRoom {
  constructor(ctx, env) {
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS world_settings (id INTEGER PRIMARY KEY, world TEXT, mode TEXT)'
    );
    const settings = ctx.storage.sql.exec('SELECT * FROM world_settings WHERE id=1').toArray()[0];
    super(ctx, env, null, settings && settings.mode !== 'legacy');
    this.env = env;
    this.directory = new OwnershipDirectory(ctx.storage);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS world_settings (id INTEGER PRIMARY KEY, world TEXT, mode TEXT);
      CREATE TABLE IF NOT EXISTS simulation_sessions (digest TEXT,owner TEXT,expires INTEGER,PRIMARY KEY(digest,owner));
      CREATE TABLE IF NOT EXISTS session_versions (digest TEXT PRIMARY KEY, version INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS session_notices (digest TEXT, owner TEXT, version INTEGER, payload TEXT, PRIMARY KEY(digest,owner));
      CREATE TABLE IF NOT EXISTS built_receipts (revision INTEGER PRIMARY KEY AUTOINCREMENT,boat TEXT UNIQUE NOT NULL,account TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pickup_receipts (id TEXT PRIMARY KEY, account TEXT, result TEXT, expires INTEGER);`);
    this.settings = settings;
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/simulation/')) return this.control(path, await request.json());
    if (this.settings?.mode === 'maintenance') return fail(503);
    if (this.settings?.mode !== 'split') return super.fetch(request);
    if (path === '/room' || path === '/bog-room') return fail(426);
    const tracked = ['/session/revoke', '/session/access', '/outfit', '/friends', '/stars'];
    if (!tracked.includes(path)) return super.fetch(request);
    const data = await request.clone().json();
    const user = this.session(data.digest);
    if (!user && path === '/session/revoke') await this.deliverNotices(data.digest);
    if (!user) return super.fetch(request);
    const owner = this.directory.find(user.account)?.owner ?? 'home';
    const sim = simulationStub(this.env, this.settings.world, owner);
    if (path === '/friends' || path === '/stars') {
      let targetAccount = data.accountId;
      let response;
      if (path === '/friends' && data.method === 'POST') {
        const result = await internalPost(sim, '/nearby', {account: user.account, playerId: data.playerId});
        if (!result.ok) return result;
        const pair = await result.json();
        if (!user.canPlay || !pair || !near(pair.self, pair.target, FRIEND_RADIUS)) return fail(409);
        targetAccount = pair.account;
        response = this.friends(data, Date.now(), targetAccount);
      } else response = await super.fetch(request);
      if (response.ok && path === '/friends' && targetAccount && data.method !== 'GET') {
        for (const account of [user.account, targetAccount]) {
          const owner = this.directory.find(account)?.owner ?? 'home';
          const dest = simulationStub(this.env, this.settings.world, owner);
          this.ctx.waitUntil(internalPost(dest, '/friends-changed', {account}).catch(() => {}));
        }
      }
      if (!response.ok) return response;
      const result = await response.json();
      const service = presenceStub(this.env, this.settings.world);
      const query =
        path === '/friends'
          ? internalPost(service, '/locations', {accounts: result.friends.map((f) => f.accountId)})
          : service.fetch('https://island.internal/read');
      const presence = await query.then((response) => response.json()).catch(() => ({players: []}));
      if (path === '/friends') {
        const players = new Map(presence.players.map((p) => [p.account, p]));
        for (const friend of result.friends) {
          const live = players.get(friend.accountId);
          if (live) friend.where = {islandId: live.islandId, x: live.x, y: live.y, mode: live.mode};
        }
      } else {
        const named = new Map(result.players);
        for (const p of presence.players) if (p.login) named.set(p.account, p.login);
        result.players = [...named];
        result.online = presence.players.map((p) => p.account);
      }
      return Response.json(result);
    }
    if (path === '/session/revoke' || path === '/session/access') {
      const response = this.ctx.storage.transactionSync(() => {
        const result = this.updateSession(path, data);
        if (path === '/session/access' && Boolean(user.canPlay) === (data.canPlay === true)) return result;
        const version = this.sql
          .exec(
            `INSERT INTO session_versions VALUES(?,1)
        ON CONFLICT(digest) DO UPDATE SET version=version+1 RETURNING version`,
            data.digest
          )
          .one().version;
        const payload = JSON.stringify({path, digest: data.digest, canPlay: data.canPlay, version});
        for (const row of this.sql.exec(
          'SELECT owner FROM simulation_sessions WHERE digest=?',
          data.digest
        )) {
          this.sql.exec(
            'INSERT OR REPLACE INTO session_notices VALUES(?,?,?,?)',
            data.digest,
            row.owner,
            version,
            payload
          );
        }
        return result;
      });
      await this.deliverNotices(data.digest);
      return response;
    }
    const response = await super.fetch(request);
    if (response.ok && path === '/outfit') {
      const result = await internalPost(sim, '/session-update', {
        path,
        account: user.account,
        outfit: data.outfit,
      });
      if (!result.ok) return result;
    }
    return response;
  }

  reconcileBoats() {
    if (this.settings?.mode === 'split' || this.settings?.mode === 'maintenance') return;
    super.reconcileBoats();
  }

  boatReturnAt(boat) {
    return this.settings && this.settings.mode !== 'legacy' ? Infinity : super.boatReturnAt(boat);
  }

  async deliverNotices(digest) {
    const notices = digest
      ? this.sql.exec('SELECT * FROM session_notices WHERE digest=?', digest).toArray()
      : this.sql.exec('SELECT * FROM session_notices').toArray();
    for (const notice of notices) {
      try {
        const target = simulationStub(this.env, this.settings.world, notice.owner);
        const r = await internalPost(target, '/session-update', JSON.parse(notice.payload));
        if (!r.ok) throw Error('Session notice pending');
        this.sql.exec(
          'DELETE FROM session_notices WHERE digest=? AND owner=? AND version=?',
          notice.digest,
          notice.owner,
          notice.version
        );
      } catch (error) {
        await this.ctx.storage.setAlarm(Date.now() + 1000);
        throw error;
      }
    }
  }

  async alarm() {
    if (this.settings?.mode === 'maintenance') return;
    await super.alarm();
    if (this.settings?.mode === 'split') await this.deliverNotices();
  }

  async control(path, data) {
    if (path === '/simulation/migrate') return migrateWorld(this, data);
    if (path === '/simulation/mode') {
      const fleetRepairPending = data.fleetRepair === true && data.target === 'split' &&
        this.ctx.storage.kv.get('migration')?.id !== data.id;
      if (data.id && data.target && ((this.settings?.mode ?? 'legacy') !== data.target || fleetRepairPending)) {
        const result = await migrateWorld(this, data);
        if (!result.ok) return result;
      }
      return Response.json({mode: this.settings?.mode ?? 'legacy'});
    }
    if (this.settings?.mode !== 'split') return fail(503);
    const {digest, account, owner, generation} = data;
    if (path === '/simulation/admit') {
      let user = this.session(digest);
      let initialOwner;
      if (data.play && user?.canPlay && !this.directory.find(user.account)) {
        const count = await presenceStub(this.env, this.settings.world).fetch('https://island.internal/player-count')
          .then(response => response.ok ? response.json() : 0).catch(() => 0);
        if (this.settings?.mode !== 'split') return fail(503);
        user = this.session(digest);
        initialOwner = pickSpawnIsland(count);
      }
      const playing = Boolean(data.play && user?.canPlay);
      const location = playing
        ? this.directory.locate(user.account, initialOwner)
        : {owner: islandFor(data.watch)?.id ?? 'home', generation: 0};
      if (playing && !this.sql.exec('SELECT 1 FROM outfits WHERE account=?', user.account).toArray().length)
        this.sql.exec('INSERT INTO outfits VALUES(?,?)', user.account, JSON.stringify(randomOutfit()));
      const outfit =
        user && this.sql.exec('SELECT outfit FROM outfits WHERE account=?', user.account).toArray()[0];
      const sessionVersion =
        user &&
        (this.sql.exec('SELECT version FROM session_versions WHERE digest=?', digest).toArray()[0]?.version ??
          0);
      if (user)
        this.sql.exec(
          'INSERT OR REPLACE INTO simulation_sessions VALUES(?,?,?)',
          digest,
          location.owner,
          user.expires
        );
      const transfer =
        playing &&
        this.sql
          .exec(
            "SELECT id FROM simulation_transfers WHERE account=? AND destination=? AND generation=? AND state='committed'",
            user.account,
            location.owner,
            location.generation - 1
          )
          .toArray()[0];
      return Response.json({
        ...location,
        sessionVersion,
        transferId: transfer?.id,
        user: user && {
          account: user.account,
          login: user.login,
          expires: user.expires,
          canPlay: Boolean(user.canPlay),
        },
        balance: user ? this.karma.balance(user.account) : 0,
        entry: user && this.karma.bogEntry(user.account),
        outfit: outfit && JSON.parse(outfit.outfit),
      });
    }
    if (path === '/simulation/feathers') {
      if (this.karma.pool.refresh(Date.now())) this.karma.persist();
      return Response.json({
        version: this.karma.pool.version,
        feathers: (this.karma.pool.activeOn(owner) ?? []).map(({slot, site}) => ({
          ...site,
          siteId: site.id,
          id: slot.id,
        })),
      });
    }
    if (path === '/simulation/end-visit') {
      if (this.karma.bogEntry(account)?.id === data.id) this.karma.endBogEntry(account);
      return new Response(null, {status: 204});
    }
    if (path === '/simulation/transfer-state') return Response.json(this.directory.transfer(data.id) ?? null);
    if (path === '/simulation/abort') return Response.json(this.directory.abort(data.id) ?? null);
    if (path === '/simulation/commit') {
      const prior = this.directory.transfer(data.id);
      if (!prior) return fail();
      if (prior.state === 'committed') return Response.json(prior);
      if (prior.state !== 'prepared') return fail();
      const session = this.session(digest);
      if (!session?.canPlay || session.account !== prior.account) return fail(403);
      if (prior.charge > 1) {
        let committed;
        const balance = this.karma.payTeleport(prior.account, prior.source, prior.destination, () => {
          committed = this.directory.commit(data.id);
          if (!committed) throw Error('Ownership changed during teleport');
        });
        return balance === null ? fail(403) : Response.json(committed);
      }
      const result = this.ctx.storage.transactionSync(() => {
        if (prior.destination === BOG_ISLAND && prior.charge && !this.karma.beginBogEntry(prior.account))
          return null;
        const committed = this.directory.commit(data.id);
        if (!committed) throw Error('Ownership changed during transfer');
        if (prior.source === BOG_ISLAND) this.karma.endBogEntry(prior.account);
        return committed;
      });
      return result ? Response.json(result) : fail(403);
    }
    if (path === '/simulation/build') {
      const receipt = this.sql
        .exec('SELECT revision FROM built_receipts WHERE boat=? AND account=?', data.boat.id, account)
        .toArray()[0];
      if (receipt) return Response.json(receipt);
    }
    const session = this.session(digest);
    if (!session?.canPlay || session.account !== account) return fail(403);
    const current = this.directory.locate(account);
    if (current.owner !== owner || current.generation !== generation) return fail();
    if (path === '/simulation/build') {
      if (owner === 'sea' || data.boat.owner !== account || data.boat.islandId !== owner) return fail();
      return Response.json(
        this.sql
          .exec(
            'INSERT INTO built_receipts(boat,account) VALUES(?,?) RETURNING revision',
            data.boat.id,
            account
          )
          .one()
      );
    }
    if (path === '/simulation/arena-entry') {
      if (owner !== BOG_ISLAND) return fail(403);
      const entry = this.karma.beginBogEntry(account);
      return entry ? Response.json({entry, balance: this.karma.balance(account)}) : fail(403);
    }
    if (path === '/simulation/release-location') {
      if (
        owner === 'home' ||
        this.sql
          .exec("SELECT id FROM simulation_transfers WHERE account=? AND state='prepared'", account)
          .toArray().length
      )
        return fail();
      this.sql.exec(
        "UPDATE simulation_owners SET owner='home',generation=generation+1 WHERE account=? AND generation=?",
        account,
        generation
      );
      return Response.json({owner: 'home'});
    }
    if (path === '/simulation/prepare') {
      if (data.teleportFare) {
        if (!TELEPORTERS.has(owner) || !TELEPORTERS.has(data.destination) ||
            data.teleportFare !== teleportPrice(data.destination)) return fail(400);
      } else if (
        ((owner === 'sea') === (data.destination === 'sea') && owner !== BOG_ISLAND) ||
        (data.destination !== 'sea' && !islandFor(data.destination))
      ) return fail(400);
      const result = this.directory.prepare({...data, source: owner});
      return result ? Response.json(result) : fail();
    }
    if (path === '/simulation/claim') {
      const prior = this.sql
        .exec('SELECT result FROM pickup_receipts WHERE id=? AND account=?', data.id, account)
        .toArray()[0];
      if (prior) return Response.json(JSON.parse(prior.result));
      const {actor} = data;
      if (actor.islandId !== owner) return fail();
      const pickup = this.karma.pool.claim(
        actor,
        Date.now(),
        (site) => site.id === data.site && this.navFor(owner).clearLine([actor.x, actor.y], [site.x, site.y])
      );
      if (!pickup) return fail();
      const total = this.karma.balance(account) + 1;
      this.ctx.storage.transactionSync(() => {
        this.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)', account, total);
        this.karma.persist();
        this.sql.exec('DELETE FROM pickup_receipts WHERE expires<?', Date.now());
        this.sql.exec(
          'INSERT INTO pickup_receipts VALUES(?,?,?,?)',
          data.id,
          account,
          JSON.stringify({pickup, total}),
          Date.now() + 86400000
        );
      });
      this.karma.balances.set(account, total);
      return Response.json({pickup, total});
    }
    return fail(404);
  }
}
