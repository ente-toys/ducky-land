import {SailRouteQueue} from './sail-route-queue.js';
import {localMigration} from './simulation-migration.js';
import {BOAT_RETURN_RETRY_MS, IslandRoom, wirePose} from './index.js';
import {internalPost, presenceStub, simulationStub, worldStub} from '../server/simulation-routing.js';
import {ISLANDS, boatHome, harborOf, islandFor, near, parkFleetBoat, placeFleetBoatHome} from '../src/gameplay/islands.js';
import {KARMA_RADIUS} from '../src/gameplay/karma-pool.js';
import {mapOf} from '../src/world/island-maps.js';
import {BOG_ISLAND} from '../src/features/bog-combat/entry.js';

const fail = (status = 409) => new Response(null, {status});
const ok = () => new Response(null, {status: 204});

class LocalSimulation extends IslandRoom {
  constructor(ctx, env, world, owner, tracing) {
    super(ctx, env, {world, owner});
    this.tracing = tracing;
    if (owner === 'sea') this.sailRoutes = new SailRouteQueue();
    this.env = env;
    this.world = worldStub(env, world);
    this.presence = presenceStub(env, world);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS outgoing (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS incoming (id TEXT PRIMARY KEY, account TEXT NOT NULL, generation INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS departed_generations (account TEXT PRIMARY KEY, generation INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS received_versions (digest TEXT PRIMARY KEY,version INTEGER);
      CREATE TABLE IF NOT EXISTS arrival_acks (account TEXT PRIMARY KEY,generation INTEGER NOT NULL,ack INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS consumed_transfers (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS pending_builds (account TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS boat_returns (id TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS boat_return_receipts (id TEXT PRIMARY KEY,version INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS build_revisions (account TEXT PRIMARY KEY,revision INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS ended_visits (id TEXT PRIMARY KEY,account TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pickup_claims (account TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS local_revision (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL);
      INSERT OR IGNORE INTO local_revision VALUES(1,0);`);
    this.transferReady = true;
    this.pendingPickups = new Map(
      this.sql
        .exec('SELECT account,payload FROM pickup_claims')
        .toArray()
        .map((row) => [row.account, JSON.parse(row.payload)])
    );
    this.claimsInFlight = new Set();
    for (const claim of this.pendingPickups.values()) this.ctx.waitUntil(this.finishPickup(claim));
    this.health = this.newHealth();
    this.reportStartedAt = Date.now();
    this.startPublishing();
    this.ctx.waitUntil(this.retryOutgoing());
    this.ctx.waitUntil(this.deliverEndedVisits());
    this.ctx.waitUntil(this.finishBuilds());
    this.ctx.waitUntil(this.sendBoatReturns());
  }

  newHealth() {
    return {
      ticks: 0,
      over150: 0,
      maxGap: 0,
      snapshotBytes: 0,
      work: {movement: 0, snapshot: 0, checkpoint: 0, route_plan: 0, route_reroute: 0, route_work: 0},
      checkpointWrites: 0,
      routeFailures: 0,
      routeFineVisits: 0,
      routeAlternatives: 0,
      routeQueuePeak: 0,
      routeQueueWait: 0,
      routeLatency: 0,
      routeWorkUnits: 0,
    };
  }

  diagnostics() {
    return {
      simulation_kind: this.simulation.owner === 'sea' ? 'sea' : 'island',
      island: this.simulation.owner,
      worker_version: this.env.CF_VERSION_METADATA?.id,
      room_epoch: this.epoch,
      connections: this.connections.size,
    };
  }

  measureWork(operation, run) {
    if (!this.health) return run();
    this.health.work[operation]++;
    if (!this.tracing) return run();
    // Native spans time synchronous work. Workers' JS clocks can freeze between I/O events.
    return this.tracing.enterSpan(`room.${operation}`, (span) => {
      span.setAttribute('room.owner', this.simulation.owner);
      return run(span);
    });
  }

  queueSailRoute(socket, info, x, y, reason, now, landing) {
    const queued = this.sailRoutes.request(socket, info, x, y, reason, now, landing);
    this.health.routeQueuePeak = Math.max(this.health.routeQueuePeak, this.sailRoutes.size);
    return queued;
  }

  planDock(socket, info, spot) {
    if (!this.sailRoutes) return super.planDock(socket, info, spot);
    if (spot.harbor) {
      const {water} = harborOf(info.actor.islandId);
      return this.queueSailRoute(socket, info, water.x, water.y, 'dock', Date.now());
    }
    return this.queueSailRoute(socket, info, spot.x, spot.y, 'dock', Date.now(), spot);
  }

  stepMovement(now) {
    if (this.sailRoutes?.size) {
      this.measureWork('route_work', (span) => {
        const initialWork = this.health.routeWorkUnits;
        this.sailRoutes.step(this, now, this.health);
        span?.setAttribute('room.route.work_units', this.health.routeWorkUnits - initialWork);
        span?.setAttribute('room.route.queue_depth', this.sailRoutes.size);
      });
    }
    return this.measureWork('movement', () => super.stepMovement(now));
  }

  broadcast(target) {
    if (target ? !this.connections.has(target) : !this.connections.size)
      return super.broadcast(target);
    return this.measureWork('snapshot', () => super.broadcast(target));
  }

  saveBoats(now, departed) {
    return this.measureWork('checkpoint', (span) => {
      const written = super.saveBoats(now, departed);
      if (written && this.health) this.health.checkpointWrites++;
      span?.setAttribute('room.checkpoint.written', Boolean(written));
      return written;
    });
  }

  step() {
    const now = Date.now();
    if (this.lastTick !== undefined) {
      const gap = now - this.lastTick;
      this.health.ticks++;
      this.health.maxGap = Math.max(this.health.maxGap, gap);
      if (gap > 150) this.health.over150++;
      if (gap >= 500 && now >= (this.nextSlowTickLogAt ?? 0)) {
        this.nextSlowTickLogAt = now + 15_000;
        console.warn('Room operation slow', {...this.diagnostics(), operation:'tick_gap', duration_ms:gap});
      }
    }
    super.step();
    this.lastTick = this.timer ? now : undefined;
    this.reportHealth(now);
  }

  reportHealth(now) {
    if (now - this.reportStartedAt >= 60_000) {
      console.info('Room operation timings', {
        ...this.diagnostics(),
        operation: 'tick_gap',
        max_ms: this.health.maxGap,
        count: this.health.ticks,
        slow_count: this.health.over150,
        snapshot_bytes: this.health.snapshotBytes,
        window_ms: now - this.reportStartedAt,
        movement_steps: this.health.work.movement,
        snapshot_broadcasts: this.health.work.snapshot,
        checkpoint_attempts: this.health.work.checkpoint,
        checkpoint_writes: this.health.checkpointWrites,
        route_plans: this.health.work.route_plan,
        route_reroutes: this.health.work.route_reroute,
        route_failures: this.health.routeFailures,
        route_fine_visits: this.health.routeFineVisits,
        route_alternatives: this.health.routeAlternatives,
        route_queue_depth: this.sailRoutes?.size ?? 0,
        route_queue_peak: this.health.routeQueuePeak,
        route_queue_wait_ms: this.health.routeQueueWait,
        route_latency_ms: this.health.routeLatency,
        route_work_units: this.health.routeWorkUnits,
      });
      this.health = this.newHealth();
      this.reportStartedAt = now;
    }
  }

  sendText(socket, text) {
    if (this.health) this.health.snapshotBytes += text.length;
    super.sendText(socket, text);
  }

  webSocketClose(socket, code, reason, wasClean) {
    console.info('Room socket closed', {...this.diagnostics(), close_code: code, was_clean: wasClean});
    super.webSocketClose(socket, code, reason, wasClean);
  }

  startPublishing() {
    if (this.publishTimer || !this.connections.size) return;
    this.publishTimer = setInterval(() => {
      this.publish();
      this.reportHealth(Date.now());
    }, 1000);
    this.publish();
  }

  publish() {
    if (this.remotePresence && Date.now() - this.lastPresenceAt > 5000) {
      this.remotePresence = null;
      this.remoteBoats = [];
      if (!this.timer) this.broadcast();
    }
    if (this.publishing) return;
    this.publishing = true;
    const players = [];
    let watchers = 0;
    const watching = new Set();
    for (const info of this.connections.values()) {
      if (info.transferring) continue;
      const a = info.actor;
      if (!a) {
        if (info.account && info.expires > Date.now()) watching.add(info.account);
        else watchers++;
        continue;
      }
      players.push({
        id: a.id,
        account: info.account,
        login: info.login,
        generation: info.generation,
        owner: this.simulation.owner,
        pose: wirePose(a),
        x: Math.round(a.x),
        y: Math.round(a.y),
        islandId: a.islandId,
        mode: a.mode,
      });
    }
    const {revision} = this.sql
      .exec('UPDATE local_revision SET revision=revision+1 WHERE id=1 RETURNING revision')
      .one();
    const boats = this.boats.map((boat) => ({owner: this.simulation.owner, boat}));
    const task = internalPost(this.presence, '/publish', {
      owner: this.simulation.owner,
      revision,
      players,
      watchers,
      watching: [...watching],
      boats,
    })
      .then(async (response) => {
        if (response.ok) {
          this.remotePresence = await response.json();
          this.lastPresenceAt = Date.now();
          const ownIds = new Set(this.boats.map((b) => b.id));
          this.remoteBoats = this.remotePresence.boats
            .filter(
              (b) =>
                b.owner !== this.simulation.owner &&
                (b.owner === 'sea' || this.simulation.owner === 'sea') &&
                !ownIds.has(b.boat.id)
            )
            .map((b) => b.boat);
          if (!this.timer) this.broadcast();
        }
      })
      .catch(() => {})
      .finally(() => {
        if (Date.now() - (this.lastPresenceAt ?? 0) > 5000) {
          this.remotePresence = null;
          this.remoteBoats = [];
        }
        this.publishing = false;
      });
    this.ctx.waitUntil(task);
    if (this.simulation.owner !== 'sea' && !this.loadingFeathers) {
      this.loadingFeathers = true;
      this.ctx.waitUntil(
        this.control('feathers', {owner: this.simulation.owner})
          .then(async (r) => {
            if (r.ok) {
              const state = await r.json();
              const key = JSON.stringify(state.feathers);
              if (key !== this.featherKey) {
                this.featherKey = key;
                this.featherRevision = (this.featherRevision ?? 0) + 1;
              }
              this.feathers = state;
            }
          })
          .catch(() => {})
          .finally(() => {
            this.loadingFeathers = false;
          })
      );
    }
    if (!this.connections.size) {
      clearInterval(this.publishTimer);
      this.publishTimer = null;
    }
  }

  control(action, data) {
    return internalPost(this.world, '/simulation/' + action, data);
  }

  serializeGlobePlayers(named) {
    return JSON.stringify(
      (this.remotePresence?.players ?? []).map(({id, islandId, x, y, mode, login}) => ({
        id,
        islandId,
        x,
        y,
        mode,
        ...(named && login && {login}),
      }))
    );
  }

  updateKarma(now) {
    for (const [socket, info] of this.connections) {
      const actor = info.actor;
      if (
        actor?.mode !== 'walking' ||
        actor.jumpLeft > 0 ||
        info.expires <= now ||
        this.pendingPickups.has(info.account) ||
        !this.feathers
      )
        continue;
      const site = this.feathers.feathers.find(
        (site) =>
          near(actor, site, KARMA_RADIUS) &&
          this.navFor(actor.islandId).clearLine([actor.x, actor.y], [site.x, site.y])
      );
      if (!site) continue;

      const data = {
        id: crypto.randomUUID(),
        account: info.account,
        digest: info.digest,
        owner: this.simulation.owner,
        generation: info.generation,
        actor: {islandId: actor.islandId, x: actor.x, y: actor.y, mode: actor.mode},
        playerId: actor.id,
        site: site.siteId,
      };
      this.sql.exec('INSERT INTO pickup_claims VALUES(?,?)', info.account, JSON.stringify(data));
      this.pendingPickups.set(info.account, data);
      this.ctx.waitUntil(this.finishPickup(data));
    }
  }

  async finishPickup(data) {
    if (this.claimsInFlight.has(data.account)) return;
    this.claimsInFlight.add(data.account);
    try {
      const response = await this.control('claim', data);
      if (!response.ok && ![403, 409].includes(response.status)) return;
      if (response.ok) {
        const {total, pickup} = await response.json();
        const info = [...this.connections.values()].find(
          (i) => i.actor?.id === data.playerId && i.generation === data.generation
        );
        if (info) {
          this.karma.balances.set(data.account, total);
          info.actor.karma = total;
          for (const viewer of this.connections.keys())
            this.send(viewer, {type: 'karma-pickup', ...pickup, playerId: data.playerId, total});
        }
      }
      this.sql.exec('DELETE FROM pickup_claims WHERE account=?', data.account);
      this.pendingPickups.delete(data.account);
    } finally {
      this.claimsInFlight.delete(data.account);
      if (this.pendingPickups.has(data.account)) await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
  }

  broadcastKarma(now, recipients) {
    for (const [socket, info] of recipients) {
      const balance = this.karma.balance(info.account);
      const key = String(this.featherRevision ?? 0) + '|' + balance;
      if (info.karmaKey === key) continue;
      info.karmaKey = key;
      this.send(socket, {
        type: 'karma-state',
        islandId: info.actor?.islandId ?? info.islandId,
        balance,
        feathers: this.feathers?.feathers ?? [],
      });
    }
  }

  buildBoat(info, spot) {
    const owner = this.simulation.owner;
    const boat = {
      id: owner + '-0~built-' + crypto.randomUUID(),
      islandId: owner,
      x: spot.x,
      y: spot.y,
      turn: spot.turn,
      occupant: null,
      departure: owner,
      parked: true,
      owner: info.account,
    };
    this.sql.exec(
      'INSERT OR IGNORE INTO pending_builds VALUES(?,?)',
      info.account,
      JSON.stringify({
        account: info.account,
        digest: info.digest,
        owner,
        generation: info.generation,
        boat,
      })
    );
    this.ctx.waitUntil(this.finishBuilds());
  }

  async finishBuilds() {
    if (this.building || this.ctx.storage.kv.get('frozen')) return;
    this.building = true;
    try {
      for (const {payload} of this.sql.exec('SELECT payload FROM pending_builds').toArray()) {
        const data = JSON.parse(payload);
        const receipt = await this.control('build', data);
        if (receipt.ok) {
          const {revision} = await receipt.json();
          await Promise.all(
            [...ISLANDS.map((island) => island.id), 'sea'].map(async (owner) => {
              const target = simulationStub(this.env, this.simulation.world, owner);
              const cleared = await internalPost(target, '/retire-built', {account: data.account, revision});
              if (!cleared.ok) throw Error('Boat replacement pending');
            })
          );
          const latest = this.sql
            .exec('SELECT revision FROM build_revisions WHERE account=?', data.account)
            .one();
          if (latest.revision === revision) {
            const boat = {...data.boat, buildRevision: revision};
            this.boats = [...this.boats.filter((b) => b.id !== boat.id), boat];
            this.saveBoats();
            for (const [socket, info] of this.connections)
              if (info.actor && info.account === data.account)
                this.send(socket, {type: 'boat-built', boatId: boat.id, x: boat.x, y: boat.y});
            this.broadcast();
          }
        } else if (![403, 409].includes(receipt.status)) throw Error('Boat build pending');
        this.sql.exec('DELETE FROM pending_builds WHERE account=?', data.account);
      }
    } finally {
      this.building = false;
      if (this.sql.exec('SELECT 1 FROM pending_builds LIMIT 1').toArray().length)
        await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
  }

  endCombatVisit(account, id) {
    this.sql.exec('INSERT OR IGNORE INTO ended_visits VALUES(?,?)', id, account);
    this.ctx.waitUntil(this.deliverEndedVisits());
  }

  async deliverEndedVisits() {
    const visits = this.sql.exec('SELECT * FROM ended_visits').toArray();
    for (const {id, account} of visits) {
      try {
        const response = await this.control('end-visit', {id, account});
        if (!response.ok) throw Error('Bog visit receipt pending');
        this.sql.exec('DELETE FROM ended_visits WHERE id=?', id);
      } catch {
        await this.ctx.storage.setAlarm(Date.now() + 1000);
        return;
      }
    }
  }

  chargeBogLanding(socket, info, island) {
    const allowed = this.allowLanding(socket, info, island);
    if (allowed && island === BOG_ISLAND) info.chargeBog = true;
    return allowed;
  }
  parkBoat(boat, landing, now = Date.now()) {
    if (this.simulation.owner !== 'sea') return super.parkBoat(boat, landing, now);
    boat.occupant = null;
    boat.parked = true;
    boat.parkedAt = now;
    boat.landing = landing ? {x:landing.x,y:landing.y} : null;
    delete boat.unattendedAt;
    delete boat.returnRetryAt;
  }

  placeReturnedBoat(boat, now) {
    const home = boatHome(boat);
    if (home === this.simulation.owner || !islandFor(home)) return super.placeReturnedBoat(boat, now);
    const returned = {...boat, occupant:null, ownershipVersion:(boat.ownershipVersion ?? 0) + 1};
    // Fence the source before the destination can expose the boat for boarding.
    this.ctx.storage.transactionSync(() => {
      this.clearBoatResume(boat);
      this.sql.exec('INSERT INTO boat_returns VALUES(?,?)',boat.id,JSON.stringify(returned));
      this.boats = this.boats.filter(item => item !== boat);
      this.saveBoats(now);
    });
  }

  async sendBoatReturns() {
    if (this.sendingBoatReturns || this.ctx.storage.kv.get('frozen')) return;
    this.sendingBoatReturns = true;
    try {
      for (const {id,payload} of this.sql.exec('SELECT * FROM boat_returns').toArray()) {
        const boat = JSON.parse(payload);
        const target = simulationStub(this.env,this.simulation.world,boatHome(boat));
        const response = await internalPost(target,'/return-boat',boat).catch(() => null);
        if (response?.ok) this.sql.exec('DELETE FROM boat_returns WHERE id=?',id);
      }
    } finally {
      this.sendingBoatReturns = false;
      await this.scheduleExpiry();
    }
  }

  acceptReturnedBoat(boat) {
    if (this.ctx.storage.kv.get('frozen')) return fail(503);
    if (boatHome(boat) !== this.simulation.owner) return fail();
    const version = boat.ownershipVersion;
    const receipt = this.sql.exec('SELECT version FROM boat_return_receipts WHERE id=?',boat.id).toArray()[0];
    if (receipt?.version >= version) return ok();
    if (this.boats.some(item => item.id === boat.id)) return fail();
    const home = placeFleetBoatHome(boat,this.boats);
    if (!home) return fail(503);
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('INSERT OR REPLACE INTO boat_return_receipts VALUES(?,?)',boat.id,version);
      this.boats.push(home);
      this.saveBoats();
    });
    this.broadcast();
    return ok();
  }

  transferIfNeeded(socket, info, previousBoat, before) {
    const actor = info.actor;
    const destination = actor.mode === 'sailing' ? 'sea' : actor.islandId;
    if (destination === this.simulation.owner) return false;
    const boat = this.boats.find((b) => b.id === (actor.boatId ?? previousBoat));
    if (!boat && (destination === 'sea' || this.simulation.owner === 'sea'))
      throw Error('Missing transfer boat');
    if (boat) boat.ownershipVersion = (boat.ownershipVersion ?? 0) + 1;
    const payload = {
      id: crypto.randomUUID(),
      account: info.account,
      digest: info.digest,
      owner: this.simulation.owner,
      destination,
      generation: info.generation,
      actor,
      boat: boat ?? null,
      before,
      chargeBog: info.chargeBog === true,
      ack: info.ack,
    };
    info.chargeBog = false;
    this.sql.exec('INSERT INTO outgoing VALUES(?,?)', payload.id, JSON.stringify(payload));
    this.boats = this.boats.filter((b) => b !== boat);
    info.actor = null;
    info.transferring = payload.id;
    this.attach(socket, info);
    this.saveBoats();
    this.ctx.waitUntil(this.retryOutgoing());
    return true;
  }

  async retryOutgoing() {
    if (this.retrying || this.ctx.storage.kv.get('frozen')) return;
    this.retrying = true;
    try {
      for (const {payload} of this.sql.exec('SELECT payload FROM outgoing').toArray()) {
        await this.finishTransfer(JSON.parse(payload));
      }
    } finally {
      this.retrying = false;
      if (this.sql.exec('SELECT id FROM outgoing LIMIT 1').toArray().length)
        await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
  }

  async finishTransfer(data) {
    const reply = await this.control('transfer-state', {id: data.id});
    if (!reply.ok) return;
    let state = await reply.json();
    if (!state) {
      const prepared = await this.control('prepare', data);
      if (!prepared.ok) {
        if ([403, 409].includes(prepared.status)) this.restoreDeparture(data);
        return;
      }
      state = await prepared.json();
    }
    if (state.state === 'prepared') {
      const target = simulationStub(this.env, this.simulation.world, data.destination);
      const staged = await internalPost(target, '/stage', data);
      if (!staged.ok) return;
      const committed = await this.control('commit', {id: data.id, digest: data.digest});
      if (!committed.ok) {
        if ([403, 409].includes(committed.status)) {
          const aborted = await this.control('abort', {id: data.id});
          if (aborted.ok && (await aborted.json())?.state === 'aborted') this.restoreDeparture(data);
        }
        return;
      }
      state = await committed.json();
    }
    if (state.state === 'aborted') {
      this.restoreDeparture(data);
      return;
    }
    if (state.state !== 'committed') return;
    this.sql.exec(
      'INSERT INTO departed_generations VALUES(?,?) ON CONFLICT(account) DO UPDATE SET generation=max(generation,excluded.generation)',
      data.account,
      data.generation
    );
    const destination = simulationStub(this.env, this.simulation.world, data.destination);
    const activated = await internalPost(destination, '/activate', {id: data.id});
    if (!activated.ok) return;
    for (const [socket, info] of this.connections)
      if (info.transferring === data.id) {
        this.send(socket, {
          type: 'transfer',
          version: 1,
          player: data.actor.id,
          generation: data.generation + 1,
        });
      }
    this.sql.exec('DELETE FROM outgoing WHERE id=?', data.id);
    console.info('Room transfer completed', {...this.diagnostics(), transfer_outcome: 'committed'});
  }

  restoreDeparture(data) {
    console.info('Room transfer restored', {...this.diagnostics(), transfer_outcome: 'aborted'});
    const actor = data.before?.actor ?? data.actor;
    const boat = data.before?.boat ?? data.boat;
    if (boat) {
      if (boat.occupant) boat.unattendedAt ??= Date.now();
      this.boats = [...this.boats.filter((b) => b.id !== boat.id), boat];
    }
    this.sql.exec(
      'INSERT OR REPLACE INTO resumes VALUES(?,?,?)',
      data.account,
      JSON.stringify(actor),
      Number.MAX_SAFE_INTEGER
    );
    this.sql.exec('DELETE FROM outgoing WHERE id=?', data.id);
    this.saveBoats();
    this.ctx.waitUntil(this.scheduleExpiry());
    for (const [socket, info] of this.connections)
      if (info.transferring === data.id) socket.close(1012, 'Rejoin the source island');
  }

  activateArrival(row) {
    const data = JSON.parse(row.payload);
    this.ctx.storage.transactionSync(() => {
      if (data.boat) {
        if (data.boat.occupant) data.boat.unattendedAt ??= Date.now();
        else parkFleetBoat(data.boat,this.boats,data.boat.parkedAt ?? Date.now(),data.boat.landing);
        this.boats = [...this.boats.filter((b) => b.id !== data.boat.id), data.boat];
      }
      this.sql.exec(
        'INSERT OR REPLACE INTO resumes VALUES(?,?,?)',
        row.account,
        JSON.stringify(data.actor),
        Number.MAX_SAFE_INTEGER
      );
      this.sql.exec(
        'INSERT OR REPLACE INTO arrival_acks VALUES(?,?,?)',
        row.account,
        row.generation,
        data.ack
      );
      this.sql.exec('INSERT OR IGNORE INTO consumed_transfers VALUES(?)', row.id);
      this.sql.exec('DELETE FROM incoming WHERE id=?', row.id);
      this.saveBoats();
    });
    this.ctx.waitUntil(this.scheduleExpiry());
  }

  async scheduleExpiry() {
    await super.scheduleExpiry();
    if (
      this.transferReady &&
      (this.pendingPickups?.size ||
        this.sql.exec('SELECT 1 FROM ended_visits UNION ALL SELECT 1 FROM pending_builds LIMIT 1').toArray()
          .length ||
        this.sql.exec('SELECT id FROM outgoing LIMIT 1').toArray().length)
    ) {
      const retry = Date.now() + 1000,
        due = await this.ctx.storage.getAlarm();
      if (due === null || due > retry) await this.ctx.storage.setAlarm(retry);
    }
    if (this.transferReady && this.sql.exec('SELECT 1 FROM boat_returns LIMIT 1').toArray().length) {
      const retry = Date.now() + BOAT_RETURN_RETRY_MS, due = await this.ctx.storage.getAlarm();
      if (due === null || due > retry) await this.ctx.storage.setAlarm(retry);
    }
  }

  async alarm() {
    if (this.ctx.storage.kv.get('frozen')) return;
    await super.alarm();
    await this.sendBoatReturns();
    await this.retryOutgoing();
    for (const data of this.pendingPickups.values()) await this.finishPickup(data);
    await this.deliverEndedVisits();
    await this.finishBuilds();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (['/migration/export', '/migration/import', '/migration/pending'].includes(url.pathname))
      return localMigration(this, url.pathname, await request.json());
    if (this.ctx.storage.kv.get('frozen')) return fail(503);
    if (url.pathname === '/return-boat') return this.acceptReturnedBoat(await request.json());
    if (url.pathname === '/activate') {
      const {id} = await request.json();
      if (this.sql.exec('SELECT 1 FROM consumed_transfers WHERE id=?', id).toArray().length) return ok();
      const state = await this.control('transfer-state', {id});
      if (!state.ok) return state;
      const committed = await state.json();
      if (committed?.destination !== this.simulation.owner || committed.state !== 'committed') return fail();
      const row = this.sql.exec('SELECT * FROM incoming WHERE id=?', id).toArray()[0];
      if (row) this.activateArrival(row);
      return ok();
    }
    if (url.pathname === '/stage') {
      const data = await request.json();
      if (data.destination !== this.simulation.owner) return fail();
      if (this.sql.exec('SELECT 1 FROM consumed_transfers WHERE id=?', data.id).toArray().length) return ok();
      this.sql.exec(
        'INSERT OR IGNORE INTO incoming VALUES(?,?,?,?)',
        data.id,
        data.account,
        data.generation + 1,
        JSON.stringify(data)
      );
      return ok();
    }
    if (url.pathname === '/retire-built') {
      const {account, revision} = await request.json();
      this.sql.exec(
        'INSERT INTO build_revisions VALUES(?,?) ON CONFLICT(account) DO UPDATE SET revision=max(revision,excluded.revision)',
        account,
        revision
      );
      const keep = this.boats.filter(
        (b) => b.owner !== account || b.occupant || (b.buildRevision ?? 0) >= revision
      );
      if (keep.length !== this.boats.length) {
        this.boats = keep;
        this.saveBoats();
        this.broadcast();
      }
      return ok();
    }
    if (url.pathname === '/friends-changed') {
      const {account} = await request.json();
      for (const [socket, info] of this.connections)
        if (info.account === account) this.send(socket, {type: 'friends-changed'});
      return ok();
    }
    if (url.pathname === '/nearby') {
      const data = await request.json(),
        active = [...this.connections.values()].filter((i) => i.actor && i.expires > Date.now());
      const self = active.find((i) => i.account === data.account),
        other = active.find((i) => i.actor.id === data.playerId);
      return self && other && self.actor.islandId === other.actor.islandId
        ? Response.json({
            self: {x: self.actor.x, y: self.actor.y},
            target: {x: other.actor.x, y: other.actor.y},
            account: other.account,
          })
        : fail();
    }
    if (url.pathname === '/session-update') {
      const data = await request.json();
      if (data.path === '/outfit') {
        this.sql.exec(
          'INSERT OR REPLACE INTO outfits VALUES(?,?)',
          data.account,
          JSON.stringify(data.outfit)
        );
        for (const [socket, info] of this.connections)
          if (info.account === data.account && info.actor) {
            info.actor.outfit = data.outfit;
            this.attach(socket, info);
          }
        this.broadcast();
        return ok();
      }
      if (!['/session/revoke', '/session/access'].includes(data.path)) return fail(400);
      const seen = this.sql
        .exec('SELECT version FROM received_versions WHERE digest=?', data.digest)
        .toArray()[0];
      if (seen && seen.version >= data.version) return ok();
      return this.ctx.storage.transactionSync(() => {
        this.sql.exec('INSERT OR REPLACE INTO received_versions VALUES(?,?)', data.digest, data.version);
        return this.updateSession(data.path, data);
      });
    }
    if (!['/room', '/bog-room'].includes(url.pathname)) return fail(404);
    const digest = request.headers.get('X-Session-Digest');
    const admission = await this.control('admit', {
      digest,
      play: url.searchParams.get('play') === '1' || url.pathname === '/bog-room',
      watch: url.searchParams.get('watch'),
    });
    if (!admission.ok) return admission;
    const {
      owner,
      generation,
      user,
      balance,
      outfit,
      entry: worldEntry,
      transferId,
      sessionVersion,
      initialSpawn,
    } = await admission.json();
    const entry =
      worldEntry && !this.sql.exec('SELECT 1 FROM ended_visits WHERE id=?', worldEntry.id).toArray().length
        ? worldEntry
        : null;
    if (
      user &&
      (this.sql.exec('SELECT version FROM received_versions WHERE digest=?', digest).toArray()[0]?.version ??
        0) > sessionVersion
    )
      return fail(403);
    if (owner !== this.simulation.owner) return fail();
    if (
      user &&
      generation &&
      this.sql
        .exec(
          'SELECT 1 FROM departed_generations WHERE account=? AND generation>=?',
          user.account,
          generation
        )
        .toArray().length
    )
      return fail();
    if (url.pathname === '/bog-room' && owner !== BOG_ISLAND) return fail(403);
    const headers = new Headers(request.headers);
    headers.delete('X-Initial-Spawn');
    if (!user) headers.delete('X-Session-Digest');
    headers.set('X-Owner-Generation', String(generation));
    if (user) {
      this.sql.exec(
        'INSERT OR REPLACE INTO sessions(digest,account,login,expires,can_play) VALUES(?,?,?,?,?)',
        digest,
        user.account,
        user.login,
        user.expires,
        user.canPlay ? 1 : 0
      );
      this.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)', user.account, balance);
      this.karma.balances.set(user.account, balance);
      if (outfit)
        this.sql.exec('INSERT OR REPLACE INTO outfits VALUES(?,?)', user.account, JSON.stringify(outfit));
      if (url.pathname === '/bog-room' && !entry) {
        const candidate = [...this.connections.values()].find(
          (i) => i.account === user.account && i.actor?.mode === 'walking'
        );
        if (!candidate || !mapOf(BOG_ISLAND).nav().walkable(candidate.actor.x, candidate.actor.y))
          return fail(403);
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return fail(426);
        if (
          url.searchParams.get('mode') !== 'lobby' &&
          !['karma', 'evil'].includes(url.searchParams.get('team'))
        )
          return fail(400);
        const result = await this.control('arena-entry', {digest, account: user.account, owner, generation});
        if (!result.ok) return result;
        const charged = await result.json();
        this.karma.balances.set(user.account, charged.balance);
        this.karma.saveBogAdmission(user.account, charged.entry);
      } else if (!entry) this.karma.endBogEntry(user.account);
      if (owner === BOG_ISLAND && entry && this.karma.bogEntry(user.account)?.id !== entry.id) {
        this.karma.saveBogAdmission(user.account, entry);
      }
      if (user.canPlay && url.searchParams.get('play') === '1' && url.pathname === '/room') {
        // Do not respawn the account while its source is frozen.
        if (
          this.sql
            .exec("SELECT 1 FROM outgoing WHERE json_extract(payload,'$.account')=? LIMIT 1", user.account)
            .toArray().length
        )
          return fail(503);
        const incoming =
          transferId &&
          this.sql
            .exec(
              'SELECT * FROM incoming WHERE id=? AND account=? AND generation=?',
              transferId,
              user.account,
              generation
            )
            .toArray()[0];
        if (incoming) this.activateArrival(incoming);
        const live = [...this.connections.values()].some((i) => i.actor && i.account === user.account);
        if (
          owner !== 'home' &&
          !initialSpawn &&
          !incoming &&
          !live &&
          !this.sql
            .exec('SELECT 1 FROM resumes WHERE account=? AND expires>?', user.account, Date.now())
            .toArray().length
        ) {
          await this.control('release-location', {account: user.account, digest, owner, generation});
          return fail(503);
        }
        if (initialSpawn) headers.set('X-Initial-Spawn', '1');
        const arrival = this.sql
          .exec('SELECT ack FROM arrival_acks WHERE account=? AND generation=?', user.account, generation)
          .toArray()[0];
        if (arrival) headers.set('X-Transfer-Ack', String(arrival.ack));
      }
    }
    const response = await super.fetch(new Request(url, {headers}));
    if (response.status === 101) {
      const reason = headers.get('X-Test-Reconnect');
      if (reason) console.info('Room client reconnected', {...this.diagnostics(), reconnect_reason: reason});

      this.startPublishing();
    }
    return response;
  }
}

// Store the object name on its first trusted binding request. Hibernation
// callbacks must also be able to restore the correct world without a request.
export class IslandSimulation {
  constructor(ctx, env, tracing) {
    this.ctx = ctx;
    this.env = env;
    this.tracing = tracing;
    this.kv = ctx.storage.kv;
    const identity = this.kv.get('simulation-key');
    if (identity) this.start(identity);
  }
  start(key) {
    const [world, owner] = JSON.parse(key);
    this.room = new LocalSimulation(this.ctx, this.env, world, owner, this.tracing);
  }
  async fetch(request) {
    if (!this.room) {
      const key = request.headers.get('X-Simulation-Key');
      if (!key) return fail(400);
      const [world, owner] = JSON.parse(key);
      const sea = this instanceof SeaSimulation;
      if (typeof world !== 'string' || (sea ? owner !== 'sea' : !islandFor(owner))) return fail(400);
      const ns = sea ? this.env.SEA_SIM : this.env.ISLAND_SIM;
      if (ns.idFromName(key).toString() !== this.ctx.id.toString()) return fail(403);
      this.kv.put('simulation-key', key);
      this.start(key);
    }
    return this.room.fetch(request);
  }
  webSocketMessage(socket, message) {
    return this.room.webSocketMessage(socket, message);
  }
  webSocketClose(socket, ...args) {
    return this.room.webSocketClose(socket, ...args);
  }
  webSocketError(socket, error) {
    return this.room.webSocketError(socket, error);
  }
  alarm() {
    return this.room?.alarm();
  }
}
export class SeaSimulation extends IslandSimulation {}
