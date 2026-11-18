const leaseMs = 5_000;
export class WorldPresence {
  constructor(ctx) {
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS summaries
      (owner TEXT PRIMARY KEY, revision INTEGER NOT NULL, expires INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS presence_generations(account TEXT PRIMARY KEY,generation INTEGER NOT NULL)`);
    this.generations = new Map(
      this.sql
        .exec('SELECT account,generation FROM presence_generations')
        .toArray()
        .map((r) => [r.account, r.generation])
    );
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const countOnly = path === '/player-count';
    const now = Date.now();
    const locations = path === '/locations' ? new Set((await request.json()).accounts) : null;
    if (path === '/publish') {
      const {owner, revision, players, watchers, watching, boats} = await request.json();
      for (const actor of players) {
        if ((this.generations.get(actor.account) ?? 0) >= actor.generation) continue;
        this.sql.exec(
          'INSERT OR REPLACE INTO presence_generations VALUES(?,?)',
          actor.account,
          actor.generation
        );
        this.generations.set(actor.account, actor.generation);
      }
      this.sql.exec(
        `INSERT INTO summaries VALUES(?,?,?,?)
        ON CONFLICT(owner) DO UPDATE SET revision=excluded.revision, expires=excluded.expires,
        payload=excluded.payload WHERE excluded.revision > summaries.revision`,
        owner,
        revision,
        now + leaseMs,
        JSON.stringify({players, watchers, watching, boats})
      );
    } else if (path !== '/read' && !locations && !countOnly) return new Response(null, {status: 404});
    const latest = new Map(),
      fleets = new Map(),
      namedWatchers = new Set();
    let spectators = 0;
    for (const {payload} of this.sql.exec('SELECT payload FROM summaries WHERE expires>?', now)) {
      const {players, watchers, watching, boats} = JSON.parse(payload);
      if (locations) {
        for (const {account, islandId, x, y, mode, generation} of players)
          if (locations.has(account) && generation === this.generations.get(account))
            latest.set(account, {account, islandId, x, y, mode});
        continue;
      }
      if (!countOnly) {
        for (const item of boats ?? []) {
          const prior = fleets.get(item.boat.id);
          if (!prior || (item.boat.ownershipVersion ?? 0) > (prior.boat.ownershipVersion ?? 0))
            fleets.set(item.boat.id, item);
        }
        for (const account of watching ?? []) namedWatchers.add(account);
        spectators += watchers;
      }
      for (const actor of players) {
        if (actor.generation === this.generations.get(actor.account)) latest.set(actor.account, actor);
      }
    }
    if (countOnly) return Response.json(latest.size);
    if (locations) return Response.json({players: [...latest.values()]});
    for (const account of latest.keys()) namedWatchers.delete(account);
    return Response.json({
      players: [...latest.values()],
      boats: [...fleets.values()],
      online: latest.size + spectators + namedWatchers.size,
    });
  }
}
