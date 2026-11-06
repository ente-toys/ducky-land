import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom} from './room-harness.mjs';
import {IslandRoom} from '../worker/index.js';

test('legacy one-way saves become requests while mutual saves remain accepted and migration runs once', async () => {
  const room = await makeRoom();
  room.sql.exec('DROP TABLE friend_requests');
  for (const account of ['1','2','3']) room.sql.exec('INSERT INTO accounts VALUES(?,?)',account,`user-${account}`);
  room.sql.exec("INSERT INTO friends VALUES('1','2',10),('2','1',11),('1','3',12)");
  const migrated = new IslandRoom(room.ctx);
  const state = migrated.friendState('1');
  assert.equal(state.friends[0].accountId,'2');
  assert.equal(state.outgoing[0].accountId,'3');
  assert.equal(state.outgoing[0].createdAt,12);
  assert.deepEqual(migrated.friendState('3').friends,[]);
  assert.equal(migrated.friendState('3').incoming[0].accountId,'1');
  assert.equal(migrated.friendState('2').friends[0].accountId,'1');
  const restored = new IslandRoom(room.ctx);
  assert.deepEqual(restored.friendState('1'),state);
});
