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
      export default {fetch(request, env, ctx) {
        if (new URL(request.url).pathname === '/room') return env.ISLAND.getByName('logs-test').fetch(request);
        let index = 0;
        const context = {request, env, waitUntil: promise => ctx.waitUntil(promise), next() {
          const handler = onRequest[index++];
          return handler ? handler(context) : Promise.resolve(new Response(null, {status: 503}));
        }};
        return context.next();
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
    let socketEpoch;
    const sockets = await Promise.all(Array.from({length: 20}, async () => {
      const response = await mf.dispatchFetch('https://local/room', {headers: {Upgrade: 'websocket'}});
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
    assert.doesNotMatch(payload, /private-query|private-cookie|private-token|private-close-reason|session=|Authorization/);
  } finally {
    await mf.dispose();
  }
});
