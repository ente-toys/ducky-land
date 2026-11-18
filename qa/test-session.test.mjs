import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestSession, connect} from '../server/pages-auth.js';

test('URL testing requires the server key and creates independent room sessions', async () => {
  const sessions = new Map();
  let joined;
  const room = {async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/room') {
      joined = request.headers.get('X-Session-Digest');
      return new Response(null);
    }
    const data = await request.json();
    if (url.pathname === '/session/new') {
      sessions.set(data.digest, data);
      return Response.json({});
    }
    return Response.json(sessions.get(data.digest) ?? null);
  }};
  const env = {MULTIPLAYER_TEST_KEY:'test-key',ISLAND:{idFromName:()=>'room',get:()=>room}};
  const request = key => new Request('https://island.example/api/test-session', {
    method:'POST',headers:{Origin:'https://island.example','X-Multiplayer-Test-Key':key},
  });
  assert.equal((await createTestSession({request:request('test-key'),env:{}})).status,404);
  assert.equal((await createTestSession({request:request('wrong'),env})).status,403);
  const foreign = new Request(request('test-key'),{headers:{Origin:'https://foreign.example','X-Multiplayer-Test-Key':'test-key'}});
  assert.equal((await createTestSession({request:foreign,env})).status,403);
  const first = await (await createTestSession({request:request('test-key'),env})).json();
  const second = await (await createTestSession({request:request('test-key'),env})).json();
  assert.notEqual(first.token,second.token);
  assert.notEqual(first.user.accountId,second.user.accountId);
  const socketRequest = token => new Request('https://island.example/api/room?play=1&testSession='+token,{
    headers:{Origin:'https://island.example',Upgrade:'websocket'},
  });
  const noGitHub = () => {throw Error('GitHub must not be contacted');};
  assert.equal((await connect({request:socketRequest(first.token),env},noGitHub)).status,200);
  assert.equal(sessions.get(joined).account,first.user.accountId);
  assert.equal((await connect({request:socketRequest(first.token),env:{...env,MULTIPLAYER_TEST_KEY:undefined}},noGitHub)).status,403);
  assert.equal((await connect({request:socketRequest('x'.repeat(43)),env},noGitHub)).status,403);
});
