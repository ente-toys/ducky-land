import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';

test('Pages and room emit structured logs without request secrets', async () => {
  const envelopes = [];
  const {outputFiles: [bundle]} = await build({
    stdin: {resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
      export {IslandRoom} from './worker/cloudflare.js';
      import {onRequest} from './functions/_middleware.js';
      import {connect} from './server/pages-auth.js';
      export default {async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const room = env.ISLAND.getByName('logs-test');
        if (url.pathname === '/room') return room.fetch(request);
        const outcome = url.searchParams.get('outcome');
        const binding = {idFromName: () => null, get: () => ({
          fetch(request) {
            if (outcome === 'throw') {
              throw Object.assign(new Error('private-room-error'), {overloaded: true});
            }
            if (outcome === 'unknown') throw new Error('private-room-error');
            if (outcome === 'unavailable') return new Response(null, {status: 503});
            return room.fetch(request);
          },
        })};
        let index = 0;
        const context = {request, env: {...env, ISLAND: binding}, data: {},
          waitUntil: promise => ctx.waitUntil(promise), next() {
            const handler = onRequest[index++];
            if (handler) return handler(context);
            if (url.pathname === '/api/room') return connect(context);
            return Promise.resolve(new Response(null, {status: 503}));
          },
        };
        try {
          return await context.next();
        } catch {
          return new Response(null, {status: 500});
        }
      }};
    `},
    bundle: true, format: 'esm', platform: 'neutral', conditions: ['workerd', 'worker', 'browser'],
    external: ['cloudflare:workers', 'node:*'], write: false,
  });
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: [{type: 'ESModule', path: 'index.js', contents: bundle.text}],
    compatibilityDate: '2026-11-02', compatibilityFlags: ['nodejs_compat'],
    bindings: {
      SENTRY_DSN: 'https://public@logs.example/1', SENTRY_ENVIRONMENT: 'local-verification',
      CF_VERSION_METADATA: {id: 'd45ffb1f-6b30-4bbb-b993-b15ee7e460ff'},
    },
    durableObjects: {ISLAND: {className: 'IslandRoom', useSQLite: true}},
    outboundService: async request => {
      envelopes.push(await request.text());
      return Response.json({});
    },
  }));
  try {
    const response = await mf.dispatchFetch('https://local/api/session?token=private-query', {
      headers: {Cookie: 'session=private-cookie', Authorization: 'Bearer private-token'},
    });
    assert.equal(response.status, 503);
    const upgradeHeaders = {Upgrade: 'websocket', Origin: 'https://local',
      'X-Ducky-Room-Upgrade-Id': '00000000-0000-4000-8000-000000000001'};
    for (const [outcome, status] of [['throw', 500], ['unknown', 500], ['unavailable', 503]]) {
      const response = await mf.dispatchFetch('https://local/api/room?outcome=' + outcome, {headers: upgradeHeaders});
      assert.equal(response.status, status);
    }
    let socketEpoch;
    const sockets = await Promise.all(Array.from({length: 20}, async (_, index) => {
      const response = index === 0
        ? await mf.dispatchFetch('https://local/api/room', {headers: upgradeHeaders})
        : await mf.dispatchFetch('https://local/room', {headers: {Upgrade: 'websocket'}});
      assert.equal(response.status, 101);
      response.webSocket.addEventListener('message', ({data}) => {
        if (typeof data !== 'string' || data === 'pong') return;
        const message = JSON.parse(data);
        if (message.type === 'snapshot') socketEpoch ??= message.epoch;
      });
      response.webSocket.accept();
      return response.webSocket;
    }));
    for (let attempt = 0; attempt < 100 && !socketEpoch; attempt++) await delay(20);
    assert.ok(socketEpoch);
    // Give one controlled close a unique code so the matching record is identifiable.
    sockets[0].close(4002, 'private-close-reason');
    for (const socket of sockets.slice(1)) socket.close(1000);
    const closeCode = /"close_code":\{"value":4002[,}]/;
    for (let attempt = 0; attempt < 100 && !closeCode.test(envelopes.join('')); attempt++) await delay(50);
    const payload = envelopes.join('\n');
    assert.match(payload, /Pages request completed/);
    assert.match(payload, /Room request completed/);
    assert.match(payload, /Room socket closed/);
    assert.match(payload, /"watchers":\{"value":20,"type":"integer"\}/);
    const closeEntry = payload.split('\n').filter(line => line.includes('Room socket closed'))
      .flatMap(line => JSON.parse(line).items)
      .find(entry => entry.body === 'Room socket closed' && entry.attributes.close_code?.value === 4002);
    assert.ok(closeEntry, 'controlled close reached the Sentry log envelope');
    assert.equal(closeEntry.attributes.room_epoch.value, socketEpoch);
    assert.match(closeEntry.attributes.object_id.value, /^[0-9a-f]{64}$/);
    assert.equal(closeEntry.attributes.worker_version.value, 'd45ffb1f-6b30-4bbb-b993-b15ee7e460ff');
    assert.equal(closeEntry.attributes.was_clean.value, true);
    const logs = payload.split('\n').filter(line => line.includes('"items":'))
      .flatMap(line => JSON.parse(line).items).filter(item => typeof item.body === 'string');
    const pagesUpgrade = logs.find(({body, attributes}) =>
      body === 'Pages request completed' && attributes.status?.value === 101);
    const requestId = pagesUpgrade?.attributes.room_upgrade_request_id?.value;
    assert.match(requestId, /^[0-9a-f-]{36}$/i, JSON.stringify(logs
      .filter(log => log.body.startsWith('Pages') || log.attributes.room_upgrade_request_id)
      .map(({body, attributes}) => [body, attributes.status?.value, attributes.room_upgrade_request_id?.value])));
    for (const message of ['Room upgrade received', 'Room request completed']) {
      assert.ok(logs.some(({body, attributes}) =>
        body === message && attributes.room_upgrade_request_id?.value === requestId));
    }

    const issues = payload.split('\n').filter(line => line.startsWith('{') && line.includes('"exception":'))
      .map(line => JSON.parse(line)).filter(event => event.tags?.room_upgrade_reason);
    assert.deepEqual(issues.map(event => event.tags.room_upgrade_reason).sort(), ['overloaded', 'unknown', 'upstream_5xx']);
    for (const issue of issues) {
      const {tags} = issue;
      assert.equal(issue.exception.values[0].value, 'Room Worker WebSocket upgrade failed');
      assert.equal(issue.exception.values[0].type, 'RoomUpgradeError');
      assert.equal(tags.route, '/api/room');
      assert.equal(typeof issue.extra.duration_ms, 'number');
      assert.notEqual(tags.room_upgrade_request_id, requestId);
      assert.ok(logs.some(({attributes}) =>
        attributes.room_upgrade_request_id?.value === tags.room_upgrade_request_id &&
        attributes.room_upgrade_reason?.value === tags.room_upgrade_reason));
      if (tags.room_upgrade_reason === 'upstream_5xx') assert.equal(tags.status, 503);
      else assert.equal(tags.room_binding_route, '/room');
    }
    assert.doesNotMatch(payload, /private-query|private-cookie|private-token|private-close-reason|private-room-error|session=|Authorization|00000000-0000-4000-8000-000000000001/);
  } finally {
    await mf.dispose();
  }
});
