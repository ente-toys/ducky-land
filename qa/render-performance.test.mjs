import test from 'node:test';
import assert from 'node:assert/strict';
import {Container} from 'pixi.js';
import {trackUpright} from '../src/rendering/shared/upright.js';
import {visibleWrapOffsets} from '../src/rendering/shared/world-texture-layout.js';

test('upright correction processes newly added children after sizing and leaves flat decks alone', () => {
  const objects = new Container(), decks = new Container();
  const upright = trackUpright([[objects], [decks, true]], .78);
  const tree = objects.addChild(new Container()), jetty = decks.addChild(new Container()), bridge = decks.addChild(new Container());
  tree.scale.y = 2; bridge.standing = true;
  upright.update();
  assert.equal(tree.scale.y, 2 / .78); assert.equal(bridge.scale.y, 1 / .78); assert.equal(jetty.scale.y, 1);
  const original = objects.children;
  Object.defineProperty(objects, 'children', {get() {throw Error('full child scan');}, configurable: true});
  upright.update();
  Object.defineProperty(objects, 'children', {value: original, configurable: true, writable: true});
  tree.removeFromParent(); objects.addChild(tree); upright.update(); assert.equal(tree.scale.y, 2 / .78);
  tree.removeFromParent(); objects.addChild(tree); tree.upright = false; tree.scale.y = 3;
  upright.update(); assert.equal(tree.scale.y, 3 / .78);
  upright.destroy(); objects.destroy({children: true}); decks.destroy({children: true});
});

test('world texture draws wrapping island and shore copies only where they reach the map', () => {
  assert.deepEqual(visibleWrapOffsets(50, 50, 10, 10, 100, 100), [[0, 0]]);
  assert.deepEqual(visibleWrapOffsets(5, 50, 10, 10, 100, 100), [[0, 0], [100, 0]]);
  assert.deepEqual(visibleWrapOffsets(95, 95, 10, 10, 100, 100), [[-100, -100], [-100, 0], [0, -100], [0, 0]]);
  assert.equal(visibleWrapOffsets(50, 50, 160, 160, 100, 100).length, 9);
});
