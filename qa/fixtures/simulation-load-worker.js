// Bundled only by the local Miniflare load harness.
import {WorldService} from '../../worker/world-service.js';
import {IslandSimulation, SeaSimulation} from '../../worker/simulation.js';
import {WorldPresence} from '../../worker/world-presence.js';
import {connect, friends} from '../../server/pages-auth.js';
import {worldStub, simulationStub, internalPost} from '../../server/simulation-routing.js';
import {ISLANDS, boardingPoint, harborOf} from '../../src/gameplay/islands.js';
import {mapOf} from '../../src/world/island-maps.js';
export {WorldPresence};

export class LoadWorld extends WorldService {
  async fetch(request) {
    if (new URL(request.url).pathname === '/owners')
      return Response.json(this.sql.exec('SELECT account,owner,generation FROM simulation_owners').toArray());
    if (new URL(request.url).pathname !== '/seed') return super.fetch(request);
    const tokens = [];
    for (let i = 0; i < 250; i++) {
      const token = crypto.randomUUID().replaceAll('-', '') + '0123456789A';
      const digest = btoa(
        String.fromCharCode(
          ...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
        )
      )
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
      const account = 'test-load-' + i;
      const island =
        i < 100 ? 'home' : ISLANDS.filter((v) => v.id !== 'home')[(i - 100) % (ISLANDS.length - 1)].id;
      const map = mapOf(island),
        nav = map.nav(),
        [x, y] = nav.nearest(map.spawn.x + (i % 12) * 45, map.spawn.y + (i % 8) * 55);
      this.sql.exec(
        'INSERT INTO sessions(digest,account,login,expires,can_play) VALUES(?,?,?,?,1)',
        digest,
        account,
        account,
        Date.now() + 86400000
      );
      this.sql.exec(
        'INSERT INTO resumes VALUES(?,?,?)',
        account,
        JSON.stringify({id: crypto.randomUUID(), islandId: island, x, y, mode: 'walking'}),
        Date.now() + 86400000
      );
      tokens.push({token, island});
    }
    return Response.json(tokens);
  }
}

function observe(Base) {
  return class extends Base {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/audit') {
        return Response.json({
          actors: [...this.room.connections.values()]
            .filter((i) => i.actor)
            .map((i) => ({
              id: i.actor.id,
              account: i.account,
              boat: i.actor.boatId,
              mode: i.actor.mode,
              generation: i.generation,
            })),
          boats: this.room.boats.map(({id, occupant}) => ({id, occupant})),
        });
      }
      if (path === '/health') return Response.json(this.timing ?? {});
      if (path === '/land-fixture') {
        const info = [...this.room.connections.values()].find((i) => i.actor?.mode === 'sailing');
        if (!info) return Response.json(null);
        const boat = this.room.boats.find((b) => b.id === info.actor.boatId);
        const harbor = harborOf(info.actor.islandId);
        const point = harbor.water;
        Object.assign(boat, point);
        Object.assign(info.actor, point);
        info.landing = {...harbor.land, islandId: info.actor.islandId, approach: point};
        Object.assign(info.actor, {sailTarget: null, sailRoute: null, docking: false});
        info.input = {x: 0, y: 0};
        if (!this.room.timer) this.room.timer = setInterval(() => this.room.step(), 50);
        this.room.step();
        return Response.json(info.login);
      }
      if (path === '/board-fixture') {
        const info = [...this.room.connections.values()].find((i) => i.actor);
        const boat = this.room.boats.find((b) => !b.occupant);
        if (!info || !boat) return Response.json(null);
        Object.assign(info.actor, boardingPoint(boat, this.room.navFor(info.actor.islandId)));
        return Response.json({login: info.login, boat: boat.id});
      }
      if (path === '/suspend-fixture') {
        // Suppress only the test island's simulation callback, keeping the
        // runtime itself available to independent island objects.
        const original = this.room.step.bind(this.room);
        this.room.step = () => {};
        setTimeout(() => {
          this.room.step = original;
        }, 2000);
        return new Response(null, {status: 204});
      }
      const response = await super.fetch(request);
      if (this.room && !this.timing) {
        const timing = (this.timing = {ticks: 0, over150: 0, maxGap: 0, histogram: {}});
        const step = this.room.step.bind(this.room);
        let previous;
        this.room.step = () => {
          const now = Date.now();
          if (previous !== undefined) {
            const gap = now - previous;
            timing.ticks++;
            if (gap > 150) timing.over150++;
            timing.maxGap = Math.max(timing.maxGap, gap);
            timing.histogram[gap] = (timing.histogram[gap] ?? 0) + 1;
          }
          step();
          previous = this.room.timer ? now : undefined;
        };
      }
      return response;
    }
  };
}
export class LoadIsland extends observe(IslandSimulation) {}
export class LoadSea extends observe(SeaSimulation) {}
export default {
  async fetch(request, bindings) {
    const env = {...bindings, ISLAND_ROOM_NAME: 'load'};
    const url = new URL(request.url),
      root = worldStub(env, 'load');
    if (url.pathname === '/owners') return internalPost(root, '/owners', {});
    if (url.pathname === '/seed') return internalPost(root, '/seed', {});
    if (url.pathname === '/start')
      return internalPost(root, '/simulation/migrate', {world: 'load', id: 'load-run', target: 'split'});
    if (url.pathname === '/room') return connect({request, env, data: {}});
    if (url.pathname === '/friends') return friends({request, env, data: {}});
    if (['/health', '/audit', '/board-fixture', '/land-fixture', '/suspend-fixture'].includes(url.pathname))
      return simulationStub(env, 'load', url.searchParams.get('island') ?? 'home').fetch(
        'https://island.internal' + url.pathname
      );
    return new Response(null, {status: 404});
  },
};
