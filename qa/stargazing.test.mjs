// The telescope's night sky: where a Ducky stands to look, where each star goes, and what the server says about who starred.
import test from 'node:test';
import assert from 'node:assert/strict';
import {telescopeSpot, telescopeNear, telescopePeerAt} from '../src/pixi/telescope.js';
import {starPlace, anonymousStars, waitingStars, readSky, skyCounts} from '../src/pixi/stargaze-sky.js';
import {makeRoom, addPlayer} from './room-harness.mjs';
import {stars} from '../server/pages-auth.js';

const props = [{id:'bench', asset:'hill-bench', x:7965, y:840}, {id:'scope', asset:'stargazing-telescope', x:8225, y:810, scale:1}];
const idle = {mode:'walking', action:0, travel:0, jumpLeft:0};

test('a Ducky looks through the telescope from the spot beside its eyepiece', () => {
  const spot = telescopeSpot(props[1]);
  assert.deepEqual([spot.x, spot.y, spot.turn], [8106, 774, Math.PI/2]);
  assert.equal(telescopeNear(props, {...idle, x:8000, y:900}).id, 'scope');
  assert.equal(telescopeNear(props, {...idle, x:7000, y:900}), null);
  assert.equal(telescopeNear(props, {...idle, mode:'sailing', x:8106, y:774}), null);
  assert.equal(telescopePeerAt(props, {...idle, x:8110, y:770}).id, 'scope');
  assert.equal(telescopePeerAt(props, {...idle, x:8110, y:770, travel:40}), null, 'a Ducky walking past does not stop to look');
  assert.equal(telescopePeerAt(props, {...idle, x:8110, y:770, action:3}), null, 'a dancing Ducky keeps dancing');
  assert.equal(telescopePeerAt(props, {...idle, x:8225, y:810}), null);
  assert.equal(telescopeNear([], {...idle, x:0, y:0}), null);
});

test('every star keeps its place', () => {
  assert.deepEqual(starPlace('121444660'), starPlace('121444660'));
  assert.notDeepEqual(starPlace('121444660'), starPlace('121444661'));
  for (const account of ['1', '42', '121444660', 'load-7']) {
    const {x, y} = starPlace(account);
    assert.ok(Math.hypot(x, y) < 2000, 'inside the star field');
  }
  const few = anonymousStars(400), many = anonymousStars(30_000);
  assert.equal(many.count, 30_000);
  for (const i of [0, 14, 15, 200, 399]) {
    assert.equal(few.x[i], many.x[i]); assert.equal(few.y[i], many.y[i]);
  }
  assert.equal(many.constellation, 15, 'the Great Duck borrows the first fifteen');
  assert.equal(anonymousStars(3).constellation, 0);
  assert.equal(anonymousStars(-5).count, 0);
  // the stars nobody has lit yet have their own places, which never move a stargazer's, and reach past the stargazers
  const waiting = waitingStars();
  assert.equal(waiting.count, 10_000);
  assert.equal(waitingStars(3).x[2], waiting.x[2]);
  assert.notEqual(waiting.x[0], many.x[0]);
  assert.ok(Array.from(waiting.x).some((x, i) => Math.hypot(x, waiting.y[i]) > 2600), 'out to the edge of what the telescope can see');
  assert.equal(waitingStars(-1).count, 0);
});

test('the sky names the people who played and counts everyone else', () => {
  const sky = readSky({total:30_048, me:{accountId:'7', login:'antara', starred:true},
    players:[['3','prag'], ['7','antara'], ['9','aswin'], ['3','prag']], online:['9'], friends:['3']});
  assert.equal(sky.total, 30_048);
  assert.deepEqual(sky.named.map(star => star.login), ['prag', 'antara', 'aswin']);
  assert.equal(sky.me.login, 'antara');
  assert.deepEqual(sky.friends.map(star => star.login), ['prag']);
  assert.equal(sky.named.find(star => star.login === 'aswin').online, true);
  assert.equal(sky.named.find(star => star.login === 'prag').online, false);
  assert.equal(sky.me.online, true, 'whoever is looking through the telescope is here');
  // a count GitHub could not give us never hides the people we do know, and you always have your own star
  const unknown = readSky({total:null, me:{accountId:'7', login:'antara', starred:true}, players:[['3','prag']], online:[], friends:[]});
  assert.equal(unknown.total, 2);
  assert.equal(unknown.me.login, 'antara');
  assert.equal(readSky({total:5, me:{accountId:'7', login:'antara', starred:false}, players:[]}).me, null);
  assert.equal(readSky(null).total, 0);
});

test('the telescope counts who is online and who is offline', () => {
  const data = {total:30_048, me:{accountId:'7', login:'antara', starred:true},
    players:[['3','prag'], ['7','antara'], ['9','aswin']], online:['9', 'stranger'], friends:[]};
  assert.deepEqual(skyCounts(data), {total:30_048, online:2, offline:30_046});
  const sky = readSky(data);
  assert.deepEqual([sky.total, sky.online, sky.offline], [30_048, 2, 30_046]);
  assert.equal(sky.named.filter(star => star.online).length, sky.online, 'every glowing star is counted, and nothing else');
  assert.deepEqual(skyCounts(null), {total:0, online:0, offline:0});
});

const post = (room, path, data) => room.fetch(new Request('https://island.internal'+path,
  {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}));

test('the room remembers who starred and answers the telescope', async () => {
  const room = await makeRoom();
  await post(room, '/session/new', {digest:'d-antara', account:'7', login:'antara', canPlay:true, githubToken:'t'});
  await post(room, '/session/new', {digest:'d-prag', account:'3', login:'prag', canPlay:true, githubToken:'t'});
  await post(room, '/session/new', {digest:'d-guest', account:'5', login:'no-star', canPlay:false, githubToken:'t'});
  assert.equal((await post(room, '/stars', {digest:'nobody'})).status, 401);
  let sky = await (await post(room, '/stars', {digest:'d-antara'})).json();
  assert.deepEqual(sky.players, [['3','prag'], ['7','antara']], 'only people who starred are named');
  assert.deepEqual(sky.me, {accountId:'7', login:'antara', starred:true});
  assert.equal(sky.total, null);
  assert.deepEqual(sky.online, []);
  // someone who removes their star is no longer named; someone who adds one is
  await post(room, '/session/access', {digest:'d-prag', canPlay:false, starred:false});
  await post(room, '/session/access', {digest:'d-guest', canPlay:true, starred:true});
  // play access withdrawn because GitHub could not be asked says nothing about the star
  await post(room, '/session/access', {digest:'d-antara', canPlay:false});
  await post(room, '/stars/count', {count:30_048});
  await post(room, '/stars/count', {count:'many'});
  room.sql.exec('INSERT INTO friends VALUES(?,?,?)', '7', '5', Date.now());
  const player = addPlayer(room, 1, {x:100, y:100});
  sky = await (await post(room, '/stars', {digest:'d-antara'})).json();
  assert.deepEqual(sky.players, [['5','no-star'], ['7','antara'], [player.account, player.account]], 'whoever is playing is named');
  assert.equal(sky.total, 30_048);
  assert.deepEqual(sky.friends, ['5']);
  assert.deepEqual(sky.online, [player.account]);
  assert.ok(!('unstarred' in sky), 'people who signed in without a star are not counted or named');
});

test('the telescope asks GitHub for the star count at most every ten minutes', async () => {
  const room = await makeRoom(), token = 'a'.repeat(43);
  const digest = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('base64url');
  await post(room, '/session/new', {digest, account:'7', login:'antara', canPlay:true, githubToken:'secret-token'});
  const env = {ISLAND:{idFromName:name => name, get:() => ({fetch:request => room.fetch(request)})}};
  const asked = [];
  const github = async (url, options) => {asked.push([url, options.headers.Authorization]); return {ok:true, json:async () => ({stargazers_count:30_048})};};
  const request = cookie => ({url:'https://ducky-land.pages.dev/api/stars', headers:new Headers(cookie ? {Cookie:cookie} : {})});
  assert.equal((await stars({request:request(), env}, github)).status, 401);
  const first = await stars({request:request(`__Host-ducky_session=${token}`), env}, github);
  const body = await first.json();
  assert.equal(first.status, 200);
  assert.equal(body.total, 30_048);
  assert.deepEqual(body.players, [['7','antara']]);
  assert.ok(!('checked' in body) && !JSON.stringify(body).includes('secret-token'), 'nothing private leaves the server');
  assert.deepEqual(asked, [['https://api.github.com/repos/ente/ente', 'Bearer secret-token']]);
  await stars({request:request(`__Host-ducky_session=${token}`), env}, github);
  assert.equal(asked.length, 1, 'the count is remembered');
  // GitHub being down keeps the last count
  room.sql.exec('UPDATE star_count SET checked=0');
  const down = await stars({request:request(`__Host-ducky_session=${token}`), env}, async () => {throw new Error('offline');});
  assert.equal((await down.json()).total, 30_048);
});
