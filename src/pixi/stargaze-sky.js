// A small eyepiece onto an endless sky. Account positions remain stable across sessions;
// only actual stargazers are bright, and only people online now form the live constellation.
const R = 2000;
const INK = '#39472d', NIGHT = '#102d34', GOLD = '#ffc65c', PALE = '#ffe4a0';
const COLORS = ['#ffc65c','#f4d68d','#ffe6b0','#deac58'];
const CLUSTERS = [[-1150,-620],[980,-940],[1240,560],[-380,1180],[420,330]];
const BAND = -.46, BAND_COS = Math.cos(BAND), BAND_SIN = Math.sin(BAND);
const TAU = Math.PI * 2;

export function mulberry(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function hashAccount(account) {
  let h = 2166136261;
  for (const letter of String(account)) {h ^= letter.codePointAt(0); h = Math.imul(h, 16777619);}
  return h >>> 0;
}
// A point of the star field: on the milky band, in one of five clusters, or anywhere in the disc.
function scatter(rnd) {
  const gauss = () => {let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*v);};
  for (;;) {
    let x, y;
    const r = rnd();
    if (r < .40) {const u = (rnd()*2-1)*R*.98, v = gauss()*R*.105*(1.15-.6*Math.abs(u)/R); x = u*BAND_COS-v*BAND_SIN; y = u*BAND_SIN+v*BAND_COS;}
    else if (r < .50) {const c = CLUSTERS[rnd()*CLUSTERS.length|0]; x = c[0]+gauss()*95; y = c[1]+gauss()*95;}
    else {const a = rnd()*TAU, d = Math.sqrt(rnd())*R; x = Math.cos(a)*d; y = Math.sin(a)*d;}
    if (x*x+y*y < R*R) return [x,y];
  }
}
// Where an account's star is. The same account always gets the same place.
export function starPlace(account) {
  const [x,y] = scatter(mulberry(hashAccount(account)));
  return {x,y};
}
// The anonymous stars: positions, size, twinkle phase and colour. Star i is the same whatever the count.
export function anonymousStars(count) {
  const rnd = mulberry(20261111), n = Math.max(0, count|0);
  const x = new Float32Array(n), y = new Float32Array(n), size = new Float32Array(n), phase = new Float32Array(n), hue = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const point = scatter(rnd);
    // The community occupies a generous sky, rather than packing 30,000 marks into the eyepiece.
    x[i] = point[0]*3; y[i] = point[1]*3;
    const m = rnd();
    size[i] = m < .80 ? .55+rnd()*.5 : m < .972 ? 1.1+rnd()*.7 : 1.9+rnd()*1.1;
    phase[i] = rnd()*TAU; hue[i] = rnd()*4|0;
  }
  return {count:n, x, y, size, phase, hue};
}

// Decorative stars are generated only for visible tiles. Coordinates (including negative tiles)
// seed each tile, so returning to a patch of sky always reveals exactly the same stars.
export const SKY_TILE = 512;
export function backgroundTile(tx, ty) {
  const rnd = mulberry(hashAccount(`sky:${tx}:${ty}`));
  return Array.from({length:96}, () => ({
    x:(tx+rnd())*SKY_TILE, y:(ty+rnd())*SKY_TILE,
    radius:.35+rnd()*.65, alpha:.15+rnd()*.23, warm:rnd()>.8,
  }));
}

// A minimum spanning tree gives the live stars one quiet constellation, with no
// invented anchor points, offline stars, or all-to-all web. Rebuilt on presence changes.
export function onlineConstellation(stars) {
  const points = stars.filter(star => star.online).sort((a,b) => a.accountId.localeCompare(b.accountId));
  if (points.length < 2) return [];
  const distance = points.map(() => Infinity), parent = points.map(() => -1), visited = new Set(), edges = [];
  distance[0] = 0;
  for (let step = 0; step < points.length; step++) {
    let next = -1;
    for (let i = 0; i < points.length; i++) if (!visited.has(i) && (next < 0 || distance[i] < distance[next])) next = i;
    visited.add(next);
    if (parent[next] >= 0) edges.push([points[parent[next]], points[next]]);
    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;
      const d = (points[i].x-points[next].x)**2+(points[i].y-points[next].y)**2;
      if (d < distance[i]) {distance[i] = d; parent[i] = next;}
    }
  }
  return edges;
}

// The numbers the telescope shows: stargazers on an island right now and every other stargazer. Whoever is looking
// through the telescope is online.
export function skyCounts(data) {
  const me = data?.me?.starred ? String(data.me.accountId) : null;
  const known = new Set((data?.players ?? []).filter(player => typeof player[1] === 'string').map(player => String(player[0])));
  if (me && typeof data.me.login === 'string') known.add(me);
  const online = new Set((data?.online ?? []).map(String).filter(accountId => known.has(accountId)));
  if (me && known.has(me)) online.add(me);
  const total = Math.max(Number.isSafeInteger(data?.total) ? data.total : 0, known.size);
  return {total, online:online.size, offline:total-online.size};
}
// Turn the server's answer into what the sky draws.
export function readSky(data) {
  const me = data?.me?.starred ? String(data.me.accountId) : null;
  const online = new Set((data?.online ?? []).map(String)), friends = new Set((data?.friends ?? []).map(String));
  const seen = new Set(), named = [];
  const add = (accountId, login) => {
    accountId = String(accountId);
    if (seen.has(accountId) || typeof login !== 'string') return;
    seen.add(accountId);
    named.push({accountId, login, ...starPlace(accountId), phase:hashAccount(accountId)%628/100,
      me:accountId === me, online:accountId === me || online.has(accountId), friend:friends.has(accountId)});
  };
  for (const [accountId,login] of data?.players ?? []) add(accountId, login);
  if (me) add(me, data.me.login);
  return {...skyCounts(data), named, me:named.find(star => star.me) ?? null, friends:named.filter(star => star.friend)};
}

const ease = t => t*t*(3-2*t);
const bound = (value, min, max) => Math.max(min, Math.min(max, value));

// Rounded, slightly uneven points, like the little inked stars in the island artwork.
function inkStar(ctx, x, y, radius, turn = 0, face = false, wink = false) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(turn);
  const points = Array.from({length:10}, (_, i) => {
    const angle = -Math.PI/2+i*Math.PI/5, r = radius*(i%2 ? .53 : [1.05,1,.97,1.03,.94][i/2]);
    return [Math.cos(angle)*r, Math.sin(angle)*r];
  });
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i+9)%10], p = points[i], next = points[(i+1)%10];
    if (!i) ctx.moveTo((prev[0]+p[0])/2, (prev[1]+p[1])/2);
    ctx.quadraticCurveTo(...p, (p[0]+next[0])/2, (p[1]+next[1])/2);
  }
  ctx.closePath();
  ctx.fillStyle = face ? '#ffdb80' : PALE;
  ctx.strokeStyle = INK; ctx.lineWidth = face ? Math.max(1.8,radius*.085) : Math.max(1,radius*.15);
  ctx.lineJoin = ctx.lineCap = 'round'; ctx.fill(); ctx.stroke();
  if (face) {
    ctx.save(); ctx.clip(); ctx.strokeStyle = '#e8b950'; ctx.lineWidth = radius*.15;
    ctx.beginPath(); ctx.arc(0,-radius*.12,radius*.77,.1,Math.PI*.8); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.6,radius*.07);
    ctx.beginPath();
    ctx.moveTo(-radius*.29,0); ctx.quadraticCurveTo(-radius*.2,-radius*.26,-radius*.1,0);
    if (wink) {ctx.moveTo(radius*.26,-radius*.12); ctx.lineTo(radius*.13,-radius*.04); ctx.lineTo(radius*.27,radius*.02);}
    else {ctx.moveTo(radius*.09,0); ctx.quadraticCurveTo(radius*.19,-radius*.26,radius*.29,0);}
    ctx.stroke();
    ctx.strokeStyle = '#c77a42'; ctx.beginPath(); ctx.moveTo(-radius*.07,radius*.13);
    ctx.quadraticCurveTo(radius*.03,radius*.27,radius*.14,radius*.12); ctx.stroke();
    ctx.fillStyle = '#fff0c7'; ctx.beginPath(); ctx.ellipse(-radius*.16,-radius*.5,radius*.08,radius*.04,-.7,0,TAU); ctx.fill();
  }
  ctx.restore();
}

export function createStargazeSky({stage, lens, canvas, tag, nameTag}) {
  const ctx = canvas.getContext('2d');
  const backdrop = document.createElement('canvas'), bg = backdrop.getContext('2d');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motion.matches;
  let sky = readSky(null), anon = anonymousStars(0), edges = [], presence = new Map();
  let cam = {x:0, y:0, z:.6}, size = 400, dpr = 1, raf = 0, running = false, loaded = false, fly = null, dirty = true;
  let greeting = null, selectedId = null, lastDraw = 0, presenceKey = '';
  const tiles = new Map(), cleanups = [], pointers = new Map();
  const sx = x => size/2+(x-cam.x)*cam.z, sy = y => size/2+(y-cam.y)*cam.z;
  const zMin = () => size/4800, zMax = 3.2;
  const listen = (target, name, fn, options) => {
    target.addEventListener(name, fn, options);
    cleanups.push(() => target.removeEventListener(name, fn, options));
  };
  const visible = (x,y,margin = 40) => (x-size/2)**2+(y-size/2)**2 < (size/2+margin)**2;

  function fit() {
    const box = stage.getBoundingClientRect(), previous = size;
    size = Math.max(120, Math.floor(Math.min(box.width,box.height)-34));
    cam.z = bound(cam.z*size/previous,zMin(),zMax);
    if (fly) {fly.z *= size/previous; fly.z0 *= size/previous;}
    lens.style.width = lens.style.height = size+'px';
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = canvas.height = backdrop.width = backdrop.height = Math.round(size*dpr);
    dirty = true;
  }
  function flyTo(x,y,z,ms = 900) {
    z = bound(z,zMin(),zMax);
    if (reduced) {cam = {x,y,z}; fly = null; dirty = true; return;}
    fly = {x0:cam.x,y0:cam.y,z0:cam.z,x,y,z,t0:performance.now(),ms};
  }
  function findMe() {
    selectStar(null);
    if (sky.me) flyTo(sky.me.x+180,sky.me.y-90,size/1500);
  }
  function frameOpening() {
    const online = sky.named.filter(star => star.online);
    const anchor = sky.me ?? online[0];
    if (!anchor) {cam = {x:0,y:0,z:size/1800}; dirty = true; return;}
    const nearby = online.filter(star => star !== anchor)
      .sort((a,b) => Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y)).slice(0,4);
    if (!nearby.length) {cam = {x:anchor.x+180,y:anchor.y-90,z:size/1500}; dirty = true; return;}
    const points = [anchor,...nearby], xs = points.map(p => p.x), ys = points.map(p => p.y);
    const x = (Math.min(...xs)+Math.max(...xs))/2, y = (Math.min(...ys)+Math.max(...ys))/2;
    const radius = Math.max(650,...points.map(p => Math.hypot(p.x-x,p.y-y)));
    cam = {x,y,z:bound(size*.32/radius,zMin(),zMax)}; dirty = true;
  }

  // The expensive, still layers are repainted only when the view or data changes.
  function paintBackdrop() {
    bg.setTransform(dpr,0,0,dpr,0,0); bg.globalAlpha = 1;
    bg.fillStyle = NIGHT; bg.fillRect(0,0,size,size);
    const wash = bg.createRadialGradient(size*.38,size*.3,0,size*.5,size*.5,size*.75);
    wash.addColorStop(0,'#183d42'); wash.addColorStop(1,NIGHT); bg.fillStyle = wash; bg.fillRect(0,0,size,size);
    const half = size/2, reach = half/cam.z;
    const minX = Math.floor((cam.x-reach)/SKY_TILE), maxX = Math.floor((cam.x+reach)/SKY_TILE);
    const minY = Math.floor((cam.y-reach)/SKY_TILE), maxY = Math.floor((cam.y+reach)/SKY_TILE);
    const used = new Set();
    for (let tx = minX; tx <= maxX; tx++) for (let ty = minY; ty <= maxY; ty++) {
      const key = `${tx}:${ty}`; used.add(key);
      if (!tiles.has(key)) tiles.set(key,backgroundTile(tx,ty));
      for (const star of tiles.get(key)) {
        const x = sx(star.x), y = sy(star.y);
        if (!visible(x,y,1)) continue;
        bg.globalAlpha = star.alpha; bg.fillStyle = star.warm ? '#c7b679' : '#78aaa7';
        const r = star.radius*(.85+.25*Math.sqrt(cam.z));
        bg.beginPath(); bg.arc(x,y,r,0,TAU); bg.fill();
      }
    }
    // Keep memory bounded even after exploring for hours.
    for (const key of tiles.keys()) if (!used.has(key)) tiles.delete(key);
    const scale = .65+.55*Math.sqrt(cam.z);
    for (let i = 0; i < anon.count; i++) {
      const x = sx(anon.x[i]), y = sy(anon.y[i]);
      if (!visible(x,y,4)) continue;
      const r = anon.size[i]*scale;
      bg.globalAlpha = anon.size[i] < 1.1 ? .48 : .78;
      bg.fillStyle = COLORS[anon.hue[i]];
      if (anon.size[i] > 2.8) inkStar(bg,x,y,Math.max(3.3,r*1.9),anon.phase[i]*.06);
      else {bg.beginPath(); bg.arc(x,y,Math.max(.4,r*.6),0,TAU); bg.fill();}
    }
    // Named offline stars use the same warm, quiet language as other GitHub stars.
    bg.globalAlpha = .85;
    for (const star of sky.named) if (!star.online && visible(sx(star.x),sy(star.y))) {
      inkStar(bg,sx(star.x),sy(star.y),4.2+Math.sqrt(cam.z)*2,star.phase*.04);
    }
    bg.globalAlpha = 1; dirty = false;
  }

  function liveStar(star, now) {
    const x = sx(star.x), y = sy(star.y);
    if (!visible(x,y,65)) return;
    const state = presence.get(star.accountId);
    const fade = reduced ? 1 : Math.min(1,(now-(state?.since ?? now))/650);
    const wave = reduced ? .5 : .5+.5*Math.sin(now/1200+star.phase);
    const r = bound(size*.036,19,37)*(1+wave*.025);
    ctx.globalAlpha = fade;
    const halo = ctx.createRadialGradient(x,y,r*.5,x,y,r*2.8);
    halo.addColorStop(0,`rgba(255,206,100,${.2+wave*.04})`); halo.addColorStop(1,'rgba(255,206,100,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x,y,r*2.8,0,TAU); ctx.fill();
    ctx.strokeStyle = '#ffd37d'; ctx.lineWidth = Math.max(2,r*.09); ctx.lineCap = 'round';
    ctx.beginPath();
    for (const angle of [-1.25,-.86,-.42,.8]) {
      const a = angle+star.phase*.12, start = r*1.15, end = start+r*(.2+wave*.06);
      ctx.moveTo(x+Math.cos(a)*start,y+Math.sin(a)*start); ctx.lineTo(x+Math.cos(a)*end,y+Math.sin(a)*end);
    }
    ctx.stroke();
    const wink = star.me || greeting?.id === star.accountId && now-greeting.at < 1100;
    inkStar(ctx,x,y,r,Math.sin(star.phase)*.08,true,wink); ctx.globalAlpha = 1;
  }
  function selectStar(star) {
    selectedId = star?.accountId ?? null;
    // Plain text only: a GitHub login must never be interpreted as markup.
    nameTag.textContent = star ? '@'+star.login : '';
    nameTag.hidden = !star;
    dirty = true;
  }
  const overlaps = (a,b) => a && b && Math.abs(a.x-b.x) < (a.w+b.w)/2+8 && Math.abs(a.y-b.y) < (a.h+b.h)/2+8;
  function labelPosition(element, star, avoid = null) {
    const x = sx(star.x), y = sy(star.y), half = size/2;
    const radius = star.online ? bound(size*.036,19,37) : 4.2+Math.sqrt(cam.z)*2;
    if (!visible(x,y,-8)) return null;
    const w = element.offsetWidth || 96, h = element.offsetHeight || 34;
    // Try above, then below. Fit all four corners inside the circular lens, including long names.
    for (const cy of [y-radius-12-h/2,y+radius+12+h/2]) {
      const dy = Math.abs(cy-half)+h/2;
      if (dy >= half-12) continue;
      const reach = Math.sqrt((half-12)**2-dy*dy)-w/2;
      if (reach < 0) continue;
      const box = {x:bound(x,half-reach,half+reach),y:cy,w,h};
      if (!overlaps(box,avoid)) return box;
    }
    return null;
  }
  function positionLabel(element, box) {
    element.style.left = box.x+'px'; element.style.top = box.y+'px';
  }
  function placeTag() {
    let ownBox = null;
    tag.hidden = !sky.me;
    if (!tag.hidden) {
      ownBox = labelPosition(tag,sky.me);
      if (ownBox) delete tag.dataset.away;
      else {
        // The same unobtrusive label brings you home if your star leaves the eyepiece.
        ownBox = {x:size/2,y:size-44,w:tag.offsetWidth || 96,h:tag.offsetHeight || 34};
        tag.dataset.away = 'true';
      }
      positionLabel(tag,ownBox);
    }
    const selected = sky.named.find(star => star.accountId === selectedId);
    if (!selected) {nameTag.hidden = true; return;}
    nameTag.hidden = false; // Measure after unhiding so long names wrap before positioning.
    let box = labelPosition(nameTag,selected,selected.me ? null : ownBox);
    if (!box) {
      box = labelPosition(nameTag,selected);
      if (box && overlaps(box,ownBox)) tag.hidden = true;
    }
    nameTag.hidden = !box;
    if (box) {
      if (selected.me) tag.hidden = true;
      positionLabel(nameTag,box);
    }
  }
  function pickStar(x,y,touch = false) {
    if (!visible(x,y,0)) return null;
    let closest = null, distance = Infinity;
    for (const star of sky.named) {
      const px = sx(star.x), py = sy(star.y);
      if (!visible(px,py,0)) continue;
      const d = Math.hypot(px-x,py-y);
      const radius = star.online ? bound(size*.036,19,37)+5 : touch ? 22 : 14;
      if (d < radius && d < distance) {closest = star; distance = d;}
    }
    return closest;
  }
  function draw(now) {
    if (dirty) paintBackdrop();
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(backdrop,0,0);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.save(); ctx.beginPath(); ctx.arc(size/2,size/2,size/2,0,TAU); ctx.clip();
    ctx.strokeStyle = '#f3c56e'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (const edge of edges) {
      const [a,b] = edge.points;
      ctx.globalAlpha = .65*(reduced ? 1 : Math.min(1,(now-edge.since)/800));
      ctx.beginPath(); ctx.moveTo(sx(a.x),sy(a.y)); ctx.lineTo(sx(b.x),sy(b.y)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const star of sky.named) if (star.online) liveStar(star,now);
    const vignette = ctx.createRadialGradient(size/2,size/2,size*.32,size/2,size/2,size*.5);
    vignette.addColorStop(0,'rgba(3,12,14,0)'); vignette.addColorStop(.85,'rgba(3,12,14,.13)'); vignette.addColorStop(1,'rgba(3,12,14,.7)');
    ctx.fillStyle = vignette; ctx.fillRect(0,0,size,size); ctx.restore(); placeTag();
  }
  function frame(now) {
    if (!running) return;
    if (fly) {
      const a = Math.min(1,(now-fly.t0)/fly.ms), e = ease(a);
      cam = {x:fly.x0+(fly.x-fly.x0)*e,y:fly.y0+(fly.y-fly.y0)*e,z:Math.exp(Math.log(fly.z0)+(Math.log(fly.z)-Math.log(fly.z0))*e)};
      if (a === 1) fly = null;
      dirty = true;
    }
    if (!document.hidden && (dirty || !reduced && now-lastDraw >= 30)) {draw(now); lastDraw = now;}
    raf = requestAnimationFrame(frame);
  }
  function zoomAt(x,y,factor) {
    const wx = cam.x+(x-size/2)/cam.z, wy = cam.y+(y-size/2)/cam.z;
    cam.z = bound(cam.z*factor,zMin(),zMax);
    cam.x = wx-(x-size/2)/cam.z; cam.y = wy-(y-size/2)/cam.z; dirty = true;
  }
  const local = event => {
    const box = canvas.getBoundingClientRect();
    return [(event.clientX-box.left)*size/box.width,(event.clientY-box.top)*size/box.height];
  };
  let moved = 0;
  listen(canvas,'pointerdown',event => {
    if (event.button !== 0) return;
    canvas.focus({preventScroll:true}); canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,local(event)); if (pointers.size === 1) moved = 0; else moved = 99;
    fly = null;
  });
  listen(canvas,'pointermove',event => {
    if (!pointers.has(event.pointerId)) return;
    const p = local(event), previous = pointers.get(event.pointerId), before = [...pointers.values()];
    pointers.set(event.pointerId,p);
    if (pointers.size === 1) {
      const dx = p[0]-previous[0], dy = p[1]-previous[1];
      cam.x -= dx/cam.z; cam.y -= dy/cam.z; moved += Math.abs(dx)+Math.abs(dy);
      if (moved > 5) lens.classList.add('dragging');
      dirty = true;
    } else if (pointers.size === 2) {
      const [a,b] = [...pointers.values()], [a0,b0] = before;
      const oldDistance = Math.hypot(a0[0]-b0[0],a0[1]-b0[1]);
      if (oldDistance > 1) zoomAt((a0[0]+b0[0])/2,(a0[1]+b0[1])/2,Math.hypot(a[0]-b[0],a[1]-b[1])/oldDistance);
      cam.x -= (a[0]+b[0]-a0[0]-b0[0])/2/cam.z; cam.y -= (a[1]+b[1]-a0[1]-b0[1])/2/cam.z;
      dirty = true;
    }
  });
  function release(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (!pointers.size) lens.classList.remove('dragging');
    if (event.type !== 'pointerup' || moved > 5) return;
    const [x,y] = local(event);
    const star = pickStar(x,y,event.pointerType === 'touch');
    selectStar(star);
    if (star) greeting = {id:star.accountId,at:performance.now()};
  }
  listen(canvas,'pointerup',release); listen(canvas,'pointercancel',release); listen(canvas,'lostpointercapture',release);
  listen(canvas,'wheel',event => {
    event.preventDefault(); fly = null;
    const delta = event.deltaY*(event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size : 1);
    zoomAt(...local(event),Math.exp(-bound(delta,-250,250)*.0018));
  },{passive:false});
  listen(canvas,'keydown',event => {
    const pan = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if (pan) {event.preventDefault(); fly = null; cam.x += pan[0]*60/cam.z; cam.y += pan[1]*60/cam.z; dirty = true;}
    else if (['+','=','-','_'].includes(event.key)) {event.preventDefault(); fly = null; zoomAt(size/2,size/2,['-','_'].includes(event.key) ? 1/1.25 : 1.25);}
    else if (event.key === 'Home') {event.preventDefault(); findMe();}
    else if (event.key === 'Enter') {
      event.preventDefault();
      const visibleStars = sky.named.filter(star => visible(sx(star.x),sy(star.y),-12));
      visibleStars.sort((a,b) => Math.hypot(sx(a.x)-size/2,sy(a.y)-size/2)-Math.hypot(sx(b.x)-size/2,sy(b.y)-size/2));
      selectStar(visibleStars[0] ?? null);
    }
  });
  listen(tag,'click',findMe);
  listen(window,'resize',() => {if (running) fit();});
  listen(motion,'change',event => {reduced = event.matches; if (reduced && fly) {cam = {x:fly.x,y:fly.y,z:fly.z}; fly = null;} dirty = true;});
  return {
    start() {if (running) return; running = true; fit(); frameOpening(); raf = requestAnimationFrame(frame);},
    setData(data) {
      sky = readSky(data);
      if (selectedId !== null) selectStar(sky.named.find(star => star.accountId === selectedId) ?? null);
      const count = sky.total-sky.named.length;
      if (count !== anon.count) anon = anonymousStars(count);
      const key = sky.named.filter(s => s.online).map(s => s.accountId).sort().join(',');
      const now = performance.now();
      if (key !== presenceKey) {
        const oldEdges = new Map(edges.map(edge => [edge.key,edge]));
        const since = loaded ? now : now-1000;
        edges = onlineConstellation(sky.named).map(points => {
          const key = points.map(p => p.accountId).sort().join(':');
          return {points,key,since:oldEdges.get(key)?.since ?? since};
        });
        presence = new Map(sky.named.filter(s => s.online).map(s => [s.accountId,presence.get(s.accountId) ?? {since}]));
        presenceKey = key;
      }
      if (!loaded) {frameOpening(); loaded = true;}
      dirty = true;
    },
    findMe,
    dispose() {
      running = false; cancelAnimationFrame(raf); pointers.clear(); tiles.clear();
      for (const cleanup of cleanups) cleanup(); tag.hidden = true; nameTag.hidden = true; nameTag.textContent = '';
    },
  };
}
