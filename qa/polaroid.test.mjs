import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas, loadImage} from '@napi-rs/canvas';
import {renderPolaroid} from '../src/rendering/shared/polaroid.js';

test('Polaroid framing preserves landscape and portrait scenes in the PNG', async () => {
  for (const [clientWidth, clientHeight, width, height] of [
    [1600, 800, 2048, 1024],
    [300, 600, 300, 600],
  ]) {
    const landscape = clientWidth > clientHeight;
    const density = landscape ? 2 : 1;
    const scene = createCanvas(clientWidth * density, clientHeight * density);
    const sky = createCanvas(scene.width, scene.height);
    const overlay = createCanvas(scene.width, scene.height);
    const sceneContext = scene.getContext('2d');
    const skyContext = sky.getContext('2d');
    const overlayContext = overlay.getContext('2d');
    skyContext.fillStyle = '#0000ff';
    skyContext.fillRect(0, 0, scene.width, scene.height);
    sceneContext.fillStyle = '#00ff00';
    sceneContext.fillRect(0, 0, scene.width / 2, scene.height);
    overlayContext.fillStyle = '#ff0000';
    overlayContext.fillRect(0, 0, scene.width, scene.height / 2);

    const viewport = {clientWidth, clientHeight, ownerDocument:{createElement() {
      return createCanvas(1, 1);
    }}};
    const blob = await renderPolaroid(viewport, [sky, scene, overlay], '#000');
    assert.equal(blob.type, 'image/png');
    const png = await loadImage(Buffer.from(await blob.arrayBuffer()));
    const border = Math.round(Math.min(width, height) * .05);
    assert.equal(png.width, width + 2 * border);
    assert.equal(png.height, height + 4 * border);
    const ctx = createCanvas(png.width, png.height).getContext('2d');
    ctx.drawImage(png, 0, 0);
    const pixel = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    assert.deepEqual(pixel(0, 0), [255, 249, 237, 255]);
    assert.deepEqual(pixel(border, border), [255, 0, 0, 255]);
    assert.deepEqual(pixel(border, border + height - 1), [0, 255, 0, 255]);
    assert.deepEqual(pixel(border + width - 1, border + height - 1), [0, 0, 255, 255]);
    assert.deepEqual(pixel(border, border + height), [255, 249, 237, 255]);
  }
});
