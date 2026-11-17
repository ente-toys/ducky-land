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
    assert.equal(png.height, height + 5 * border);
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

test('Polaroid caption writes the player name under the photo', async () => {
  const scene = createCanvas(400, 200);
  const viewport = {clientWidth:400, clientHeight:200, ownerDocument:{createElement() {
    return createCanvas(1, 1);
  }}};
  const inkIn = async player => {
    const png = await loadImage(Buffer.from(await (await renderPolaroid(viewport, [scene], '#000', {player})).arrayBuffer()));
    const ctx = createCanvas(png.width, png.height).getContext('2d');
    ctx.drawImage(png, 0, 0);
    const border = Math.round(200 * .05);
    // Left half of the caption strip: where the name goes.
    const {data} = ctx.getImageData(border, border * 2 + 200, Math.round(png.width / 2) - border, border * 3 - border);
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 120) dark++;
    return dark;
  };
  assert.equal(await inkIn(''), 0);
  assert.ok(await inkIn('mallard') > 0);
});

test('Polaroid captures visible username tags at their scaled positions inside the photo', async () => {
  const scene = createCanvas(400, 200);
  const box = (left, top, width, height) => ({left, top, width, height, right:left + width, bottom:top + height});
  const tag = (textContent, left, top, hidden = false) => ({
    textContent, hidden, getBoundingClientRect:() => box(left, top, 52, 16),
  });
  const nameLayer = {children:[
    tag('@mallard', 45, 32),
    tag('@teal', 167, 16),
    tag('@hidden', 108, 68, true),
  ]};
  const nameStyle = {
    backgroundColor:'#fff9df', color:'#584534', borderTopWidth:'1px', borderTopColor:'#785f46',
    borderTopLeftRadius:'7px', fontWeight:'600', fontSize:'10px', fontFamily:'sans-serif',
  };
  const viewport = {
    clientWidth:200, clientHeight:100, getBoundingClientRect:() => box(20, 25, 200, 100),
    ownerDocument:{
      createElement:() => createCanvas(1, 1),
      defaultView:{getComputedStyle:node => node === nameLayer ? {opacity:'1', visibility:'visible'} : nameStyle},
    },
  };
  const blob = await renderPolaroid(viewport, [scene], '#000', {nameLayer});
  const png = await loadImage(Buffer.from(await blob.arrayBuffer()));
  const context = createCanvas(png.width, png.height).getContext('2d');
  context.drawImage(png, 0, 0);
  const pixel = (x, y) => Array.from(context.getImageData(x, y, 1, 1).data);
  assert.deepEqual(pixel(92, 52), [255, 249, 223, 255], 'first tag has its cream background');
  assert.ok(context.getImageData(72, 28, 80, 25).data.some((value, i) => i % 4 === 0 && value === 88),
    'the username is painted in its text color');
  assert.deepEqual(pixel(325, 15), [255, 249, 223, 255], 'second tag stays at its own position');
  assert.deepEqual(pixel(330, 9), [255, 249, 237, 255], 'the tag is clipped to the frame');
  assert.deepEqual(pixel(210, 112), [0, 0, 0, 255], 'hidden tags are omitted');
});
