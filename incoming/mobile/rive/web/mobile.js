'use strict';
// The host handles input and simulation. Every visible game pixel, including
// joystick, walk target and buttons, is native Rive artwork on one canvas.
(() => {
  rive.RuntimeLoader.setWasmUrl('rive.wasm');
  rive.RuntimeLoader.setWasmFallbackUrl('rive_fallback.wasm');
  const W = 1600, H = 1000;
  const canvas = document.getElementById('c'), play = document.getElementById('play');
  const actions = document.getElementById('actions'), danceButton = document.getElementById('dance'), status = document.getElementById('status');
  const params = new URLSearchParams(location.search);
  const qualityMode = ['high', 'low'].includes(params.get('quality')) ? params.get('quality') : 'auto';
  const constrained = navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  let quality = qualityMode === 'low' || (qualityMode === 'auto' && constrained) ? 'low' : 'high';
  let crowdCount = quality === 'low' ? 5 : Math.max(12, Math.min(15, Number(params.get('crowd')) || 12));
  const NAMES = ['quackers', 'mo', 'aya_22', 'bread_boy', 'pip', 'lulu', 'nori', 'miso', 'toto', 'sunny', 'peep', 'boba', 'kai', 'bea', 'waddles'];
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const walkable = (x, y) => ((x - 800) / 560) ** 2 + ((y - 640) / 290) ** 2 <= 1 && ((x - 800) / 250) ** 2 + ((y - 575) / 120) ** 2 >= 1;
  function randomSpot() { for (;;) { const x = rnd(260, 1340), y = rnd(360, 915); if (walkable(x, y)) return [x, y]; } }
  function makeDuck(i, isPlayer) {
    const [x, y] = isPlayer ? [800, 820] : randomSpot();
    return { x, y, tx: x, ty: y, player: isPlayer, action: 0, facing: 1, until: 0, wait: rnd(0, 2), path: [],
      name: isPlayer ? 'you' : NAMES[i], city: isPlayer ? 1 : i % 4,
      cap: isPlayer ? 8 : (Math.random() < .85 ? 1 + Math.floor(rnd(0, 13)) : 0),
      shades: Math.random() < .35 ? 1 + Math.floor(rnd(0, 3)) : 0,
      acc: Math.random() < .45 ? 1 + Math.floor(rnd(0, 7)) : 0, // file's slots exclude Acc 6
      shoes: Math.random() < .7 ? 1 + Math.floor(rnd(0, 10)) : 0 };
  }
  const ducks = [makeDuck(0, true), ...Array.from({ length: 15 }, (_, i) => makeDuck(i, false))];
  const player = ducks[0], keys = new Set();
  const camera = { x: 800, y: 500, scale: 1, ox: 0, oy: 0, width: 0, height: 0 };
  const joystick = { id: null, x: 0, y: 0, dx: 0, dy: 0, vx: 0, vy: 0, dragged: false, began: 0 };
  let now = 0, last = 0, ready = false, loopStarted = false, vmi, slots = [], slotCache = [], values = {}, root = {};
  let safe = { top: 0, right: 0, bottom: 0, left: 0 };
  let resizePending = true, loadedAt = 0, autoSlowWindows = 0, autoWindow = [];
  let frameTimes = [], workTimes = [], riveTimes = [], longTasks = [], qualityChanges = [];
  let measuring = false, measureStarted = 0, measureLast = 0;
  const errors = [];
  addEventListener('error', e => errors.push(e.message));
  if ('PerformanceObserver' in window) {
    try { new PerformanceObserver(list => { if (measuring) longTasks.push(...list.getEntries().map(e => e.duration)); }).observe({ type: 'longtask', buffered: false }); } catch {}
  }
  function set(name, value) { if (values[name] !== value && root[name]) { root[name].value = value; values[name] = value; } }
  function quack() { player.action = 2; player.until = now + 1.25; }
  function dance() { player.path.length = 0; player.action = player.action === 3 ? 0 : 3; player.until = player.action === 3 ? now + 6 : 0; }
  function stopInput() {
    joystick.id = null; joystick.vx = joystick.vy = joystick.dx = joystick.dy = 0;
    keys.clear(); player.path.length = 0;
    if (player.action === 1) player.action = 0;
    set('stickOn', 0); set('quackOn', 0);
  }
  // A visibility graph around the fountain routes taps around its basin.
  function clearLine(a, b) {
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 10);
    for (let i = 0; i <= count; i++) if (!walkable(a[0] + (b[0] - a[0]) * i / (count || 1), a[1] + (b[1] - a[1]) * i / (count || 1))) return false;
    return true;
  }
  function pathTo(x, y) {
    if (!walkable(x, y)) return [];
    const start = [player.x, player.y], target = [x, y];
    if (clearLine(start, target)) return [target];
    const points = [start, target, ...Array.from({ length: 24 }, (_, i) => [800 + 276 * Math.cos(i * Math.PI / 12), 575 + 144 * Math.sin(i * Math.PI / 12)])];
    const distances = points.map(() => Infinity), previous = [], visited = new Set(); distances[0] = 0;
    for (let pass = 0; pass < points.length; pass++) {
      let n = -1;
      for (let i = 0; i < points.length; i++) if (!visited.has(i) && (n < 0 || distances[i] < distances[n])) n = i;
      if (n === 1 || n < 0 || distances[n] === Infinity) break;
      visited.add(n);
      for (let i = 1; i < points.length; i++) if (!visited.has(i) && clearLine(points[n], points[i])) {
        const distance = distances[n] + Math.hypot(points[i][0] - points[n][0], points[i][1] - points[n][1]);
        if (distance < distances[i]) { distances[i] = distance; previous[i] = n; }
      }
    }
    if (distances[1] === Infinity) return [];
    const path = []; for (let i = 1; i !== 0; i = previous[i]) path.unshift(points[i]); return path;
  }
  function toArtboard(x, y) { const rect = canvas.getBoundingClientRect(); return [(x - rect.left - camera.ox) / camera.scale, (y - rect.top - camera.oy) / camera.scale]; }
  function toScreen(x, y) { return [x * camera.scale + camera.ox, y * camera.scale + camera.oy]; }
  canvas.addEventListener('pointerdown', e => {
    if (!ready || joystick.id !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    Object.assign(joystick, { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, vx: 0, vy: 0, dragged: false, began: performance.now() });
    player.path.length = 0;
    if (e.pointerType !== 'mouse') { set('joystickX', e.clientX); set('joystickY', e.clientY); set('stickX', 0); set('stickY', 0); set('stickOn', 1); }
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== joystick.id) return;
    e.preventDefault();
    const dx = e.clientX - joystick.x, dy = e.clientY - joystick.y, length = Math.hypot(dx, dy);
    if (length > 7) joystick.dragged = true;
    if (!joystick.dragged) return;
    const travel = Math.min(36, length), strength = clamp((length - 6) / 30, 0, 1);
    joystick.dx = dx / (length || 1) * travel; joystick.dy = dy / (length || 1) * travel;
    joystick.vx = dx / (length || 1) * strength; joystick.vy = dy / (length || 1) * strength;
    set('joystickX', joystick.x); set('joystickY', joystick.y); set('stickX', joystick.dx); set('stickY', joystick.dy); set('stickOn', 1);
  });
  function release(e, cancelled) {
    if (e.pointerId !== joystick.id) return;
    e.preventDefault();
    const tap = !cancelled && !joystick.dragged && performance.now() - joystick.began < 400;
    joystick.id = null; joystick.vx = joystick.vy = 0; set('stickOn', 0);
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (tap) { const [x, y] = toArtboard(e.clientX, e.clientY); player.path = pathTo(x, y); player.tx = x; player.ty = y; if (player.path.length && player.action === 3) player.action = 0; }
  }
  canvas.addEventListener('pointerup', e => release(e, false));
  canvas.addEventListener('pointercancel', e => release(e, true));
  canvas.addEventListener('lostpointercapture', e => { if (e.pointerId === joystick.id) release(e, true); });
  for (const [id, fn, property] of [['quack', quack, 'quackOn'], ['dance', dance, 'danceOn']]) {
    const button = document.getElementById(id);
    button.addEventListener('pointerdown', e => { if (!ready) return; e.preventDefault(); button.setPointerCapture(e.pointerId); set(property, 1); fn(); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => set(property, 0));
    button.addEventListener('click', e => { if (e.detail === 0 && ready) fn(); });
  }
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys.add(k); if (e.repeat || !ready) return;
    if (k === 'q') quack(); if (k === 'e') dance(); if (k === 'escape') stopInput();
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  for (const event of ['contextmenu', 'gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'wheel']) document.addEventListener(event, e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  addEventListener('blur', stopInput);
  document.addEventListener('visibilitychange', () => {
    stopInput(); last = measureLast = 0;
    if (document.hidden) r.stopRendering(); else if (ready) r.startRendering();
  });
  function resize() {
    resizePending = false;
    const rect = play.getBoundingClientRect(), padding = getComputedStyle(document.getElementById('safe'));
    safe = { top: parseFloat(padding.paddingTop) || 0, right: parseFloat(padding.paddingRight) || 0, bottom: parseFloat(padding.paddingBottom) || 0, left: parseFloat(padding.paddingLeft) || 0 };
    camera.width = rect.width; camera.height = rect.height;
    const narrow = Math.min(rect.width, rect.height) < 600;
    camera.scale = narrow ? (rect.height > rect.width ? clamp(rect.width / 620, .56, .82) : clamp(rect.height / 610, .56, .8)) : Math.min(rect.width / 1200, rect.height / 950);
    r.resizeDrawingSurfaceToCanvas(devicePixelRatio || 1);
    const bounds = actions.getBoundingClientRect(); set('controlX', bounds.left + 29); set('controlY', bounds.top + 22);
    stopInput(); updateCamera(1, true);
  }
  addEventListener('resize', () => { resizePending = true; });
  visualViewport?.addEventListener('resize', () => { resizePending = true; });
  new ResizeObserver(() => { resizePending = true; }).observe(play);
  function watchDpr() { matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => { resizePending = true; watchDpr(); }, { once: true }); } watchDpr();
  function updateCamera(dt, snap = false) {
    const portrait = camera.height > camera.width, visibleW = camera.width / camera.scale, visibleH = camera.height / camera.scale;
    const centerX = clamp(player.x, visibleW / 2, W - visibleW / 2), aimY = player.y - (portrait ? .27 : .12) * visibleH;
    const centerY = visibleH > H ? 500 + clamp((player.y - 820) * .35, -90, 40) : clamp(aimY, visibleH / 2, H - visibleH / 2);
    const blend = snap ? 1 : 1 - Math.exp(-dt * 8);
    camera.x += (centerX - camera.x) * blend; camera.y += (centerY - camera.y) * blend;
    camera.ox = camera.width / 2 - camera.x * camera.scale; camera.oy = camera.height / 2 - camera.y * camera.scale;
    set('cameraX', camera.ox); set('cameraY', camera.oy); set('zoom', camera.scale);
  }
  function move(d, vx, vy, dt, speed) {
    const nx = d.x + vx * speed * dt, ny = d.y + vy * speed * dt;
    if (walkable(nx, ny)) { d.x = nx; d.y = ny; }
    else if (walkable(nx, d.y)) d.x = nx; else if (walkable(d.x, ny)) d.y = ny;
    if (Math.abs(vx) > .04) d.facing = vx < 0 ? -1 : 1;
    if (d.action !== 2) d.action = 1;
  }
  function stepPlayer(dt) {
    if ((player.action === 2 || player.action === 3) && now > player.until) player.action = 0;
    let vx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    let vy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    if (vx || vy) { const length = Math.hypot(vx, vy); vx /= length; vy /= length; player.path.length = 0; }
    else if (joystick.id !== null) { vx = joystick.vx; vy = joystick.vy; }
    else if (player.path.length) {
      const [x, y] = player.path[0], dx = x - player.x, dy = y - player.y, length = Math.hypot(dx, dy);
      if (length < Math.max(2, 150 * dt)) { player.x = x; player.y = y; player.path.shift(); } else { vx = dx / length; vy = dy / length; }
    }
    if (vx || vy) move(player, vx, vy, dt, 150); else if (player.action === 1) player.action = 0;
    const dancing = player.action === 3; if (danceButton.getAttribute('aria-pressed') !== String(dancing)) danceButton.setAttribute('aria-pressed', String(dancing));
    set('danceOn', dancing ? 1 : 0);
    set('tapOn', player.path.length ? 1 : 0); if (player.path.length) { set('tapX', player.tx); set('tapY', player.ty); }
  }
  function stepCrowd(d, dt) {
    if ((d.action === 2 || d.action === 3) && now < d.until) return;
    if (d.action === 2 || d.action === 3) d.action = 0;
    const dx = d.tx - d.x, dy = d.ty - d.y, length = Math.hypot(dx, dy);
    if (length > 4) {
      if (walkable(d.x + dx / length * 105 * dt, d.y + dy / length * 105 * dt)) move(d, dx / length, dy / length, dt, 105);
      else { d.tx = d.x; d.ty = d.y; d.action = 0; } return;
    }
    d.action = 0; d.wait -= dt; if (d.wait > 0) return;
    const chance = Math.random();
    if (chance < .15) { d.action = 3; d.until = now + rnd(2, 5); }
    else if (chance < .3) { d.action = 2; d.until = now + 1.25; } else [d.tx, d.ty] = randomSpot();
    d.wait = rnd(.8, 3.5);
  }
  function sync() {
    const order = ducks.slice(0, crowdCount + 1).sort((a, b) => a.y - b.y);
    for (let i = 0; i < slots.length; i++) {
      const d = order[i], cache = slotCache[i], props = slots[i];
      const write = (key, value) => { if (cache[key] !== value) { props[key].value = value; cache[key] = value; } };
      if (!d) { write('x', -2000); continue; }
      write('x', Math.round(d.x * 2) / 2); write('y', Math.round(d.y * 2) / 2);
      for (const key of ['action', 'facing', 'cap', 'shades', 'acc', 'shoes', 'city']) write(key, d[key]);
      write('isPlayer', d.player ? 1 : 0); write('name', ' ' + d.name + ' ');
    }
  }
  function percentile(samples, p) { if (!samples.length) return 0; const sorted = [...samples].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]; }
  function stats(samples) { return { samples: samples.length, mean: samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0, p50: percentile(samples, .5), p95: percentile(samples, .95), p99: percentile(samples, .99), max: samples.length ? Math.max(...samples) : 0 }; }
  function loop(t) {
    requestAnimationFrame(loop);
    if (!ready || document.hidden) { last = 0; return; }
    const workStart = performance.now(), elapsed = last ? t - last : 0, dt = Math.min(.05, elapsed / 1000); last = t; now += dt;
    if (resizePending) resize();
    stepPlayer(dt); for (let i = 1; i <= crowdCount; i++) stepCrowd(ducks[i], dt); updateCamera(dt); sync();
    if (measuring) { if (measureLast) frameTimes.push(t - measureLast); measureLast = t; workTimes.push(performance.now() - workStart); }
    if (qualityMode === 'auto' && quality === 'high' && performance.now() - loadedAt > 5000 && elapsed > 0) {
      autoWindow.push(elapsed);
      if (autoWindow.length >= 120) {
        autoSlowWindows = percentile(autoWindow, .5) > 22 ? autoSlowWindows + 1 : 0; autoWindow = [];
        if (autoSlowWindows >= 2) setQuality('low', 'sustained frame pacing above 22ms');
      }
    }
  }
  function setQuality(next, reason = 'manual') {
    if (next === quality) return;
    qualityChanges.push({ from: quality, to: next, reason, at: performance.now() });
    quality = next; crowdCount = next === 'low' ? 5 : 12; ready = false; stopInput();
    r.load({ src: next === 'low' ? 'ducky-land-lite.riv' : 'ducky-land.riv', autoplay: true, autoBind: true, artboard: 'Plaza', stateMachines: 'Plaza' });
  }
  function onLoad() {
    vmi = r.viewModelInstance; slots = []; slotCache = []; values = {}; root = {};
    for (const name of ['cameraX', 'cameraY', 'zoom', 'controlX', 'controlY', 'joystickX', 'joystickY', 'stickX', 'stickY', 'stickOn', 'tapX', 'tapY', 'tapOn', 'quackOn', 'danceOn']) root[name] = vmi.number(name);
    for (let i = 0; i < (quality === 'low' ? 6 : 16); i++) {
      const slot = vmi.viewModel('slot' + i), props = { name: slot.string('name') };
      for (const key of ['x', 'y', 'action', 'facing', 'cap', 'shades', 'acc', 'shoes', 'city', 'isPlayer']) props[key] = slot.number(key);
      slots.push(props); slotCache.push({});
    }
    ready = true; loadedAt = performance.now(); last = 0; resize(); sync(); status.hidden = true;
    if (!loopStarted) { loopStarted = true; requestAnimationFrame(loop); }
  }
  // Time the runtime advance + draw CPU work separately from host simulation.
  const originalDraw = rive.Rive.prototype.draw;
  rive.Rive.prototype.draw = function (...args) { const start = performance.now(); try { return originalDraw.apply(this, args); } finally { if (measuring) riveTimes.push(performance.now() - start); } };
  const r = new rive.Rive({ src: quality === 'low' ? 'ducky-land-lite.riv' : 'ducky-land.riv', canvas, autoplay: true, autoBind: true,
    artboard: 'Plaza', stateMachines: 'Plaza', shouldDisableRiveListeners: true, enableRiveAssetCDN: false,
    layout: new rive.Layout({ fit: rive.Fit.Layout, layoutScaleFactor: 1 }), onLoad,
    onLoadError: e => { status.hidden = false; status.textContent = 'The plaza could not load. Refresh to try again.'; errors.push(String(e?.data || e)); },
  });
  window.game = {
    r, ducks, player, camera, joystick, toArtboard, toScreen, walkable, pathTo, setQuality,
    get ready() { return ready; }, get quality() { return quality; }, get crowdCount() { return crowdCount; }, get slots() { return slots; }, get vmi() { return vmi; },
    startBenchmark() { frameTimes = []; workTimes = []; riveTimes = []; longTasks = []; measureLast = 0; measureStarted = performance.now(); measuring = true; },
    stopBenchmark() { measuring = false; return { durationMs: performance.now() - measureStarted, duckies: crowdCount + 1, instantiatedSlots: slots.length, quality, qualityMode,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, backingWidth: canvas.width, backingHeight: canvas.height }, frameMs: stats(frameTimes), hostCpuMs: stats(workTimes), riveCpuMs: stats(riveTimes),
      over20ms: frameTimes.filter(n => n > 20).length, over33ms: frameTimes.filter(n => n > 33.5).length, longTasks, qualityChanges, errors, visibility: document.visibilityState, safeArea: safe, camera: { ...camera }, rawFrames: frameTimes }; },
  };
})();
