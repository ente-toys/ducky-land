const R = 2000;
const INK = '#39472d', NIGHT = '#16323c', GOLD = '#ffb937', PALE = '#ffd98a', TAG = '#fff9df';
const COLORS = ['#ffb937','#ffc65c','#ffd98a','#f0a62e'];
const OFFLINE = .62, WAITING = .34;
const WIDE = R*1.4, UNLIT = 10_000;
const CLUSTERS = [[-1150,-620],[980,-940],[1240,560],[-380,1180],[420,330]];
const BAND = -.46, BAND_COS = Math.cos(BAND), BAND_SIN = Math.sin(BAND);
const DUCK = [[0,.2],[1.1,-.1],[1.5,-1.2],[2.6,-1.75],[3.6,-1.05],[3.55,.3],[5.2,.85],[6.8,.25],[7.7,-.85],[7.25,1.6],[5.6,2.9],[3,3.05],[1.6,2.05],[1.3,.8]];
const DUCK_AT = [-1010,330], DUCK_SIZE = 88, DUCK_EYE = [2.45,-.85];
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
export function starPlace(account) {
  const [x,y] = scatter(mulberry(hashAccount(account)));
  return {x,y};
}
export function anonymousStars(count) {
  const rnd = mulberry(20261111), n = Math.max(0, count|0);
  const x = new Float32Array(n), y = new Float32Array(n), size = new Float32Array(n), phase = new Float32Array(n), hue = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    [x[i],y[i]] = scatter(rnd);
    const m = rnd();
    size[i] = m < .80 ? .55+rnd()*.5 : m < .972 ? 1.1+rnd()*.7 : 1.9+rnd()*1.1;
    phase[i] = rnd()*TAU; hue[i] = rnd()*4|0;
  }
  const constellation = n > DUCK.length ? DUCK.length+1 : 0;
  for (let i = 0; i < constellation; i++) {
    const p = DUCK[i] ?? DUCK_EYE;
    x[i] = DUCK_AT[0]+p[0]*DUCK_SIZE; y[i] = DUCK_AT[1]+p[1]*DUCK_SIZE; size[i] = i < DUCK.length ? 2.5 : 1.9;
  }
  return {count:n, x, y, size, phase, hue, constellation};
}
export function waitingStars(count = UNLIT) {
  const rnd = mulberry(20261112), n = Math.min(20_000, Math.max(0, count|0));
  const x = new Float32Array(n), y = new Float32Array(n), size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = rnd()*TAU, d = Math.sqrt(rnd())*WIDE;
    x[i] = Math.cos(a)*d; y[i] = Math.sin(a)*d; size[i] = .7+rnd()*.7;
  }
  return {count:n, x, y, size};
}
export function skyCounts(data) {
  const me = data?.me?.starred ? String(data.me.accountId) : null;
  const known = new Set((data?.players ?? []).filter(player => typeof player[1] === 'string').map(player => String(player[0])));
  if (me && typeof data.me.login === 'string') known.add(me);
  const online = new Set((data?.online ?? []).map(String).filter(accountId => known.has(accountId)));
  if (me && known.has(me)) online.add(me);
  const total = Math.max(Number.isSafeInteger(data?.total) ? data.total : 0, known.size);
  return {total, online:online.size, offline:total-online.size};
}
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

const ease = t => t < .5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
const escapeText = text => String(text).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const starIcon = level => `<svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true"><circle r="11" fill="${NIGHT}"/><path d="M0 -7.2L2.2 -2.5 7.3 -2 3.5 1.5 4.5 6.6 0 4.1 -4.5 6.6 -3.5 1.5 -7.3 -2 -2.2 -2.5Z" fill="${GOLD}" opacity="${level}"/></svg>`;

export function createStargazeSky({stage, lens, canvas, tag, onNews = () => {}}) {
  const ctx = canvas.getContext('2d'), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const waiting = waitingStars();
  let anon = anonymousStars(0), sky = readSky(null), buckets = COLORS.map(() => [[],[]]), bright = [], grid = new Map();
  let cam = {x:0, y:0, z:.14}, size = 400, dpr = 1, raf = 0, running = false, loaded = false, fly = null, focus = null, pinned = false;
  let shooting = null;
  const born = new Map(), queue = [];
  const CELL = 90;
  const zMin = () => size/(R*2.08), zMax = 3.2;
  const sx = x => size/2+(x-cam.x)*cam.z, sy = y => size/2+(y-cam.y)*cam.z;

  function index() {
    buckets = COLORS.map(() => [[],[]]); bright = []; grid = new Map();
    for (let i = 0; i < anon.count; i++) {
      if (anon.size[i] >= 1.9) bright.push(i); else buckets[anon.hue[i]][anon.size[i] < 1.1 ? 0 : 1].push(i);
      const key = ((anon.x[i]+R)/CELL|0)*256+((anon.y[i]+R)/CELL|0);
      const cell = grid.get(key); if (cell) cell.push(i); else grid.set(key,[i]);
    }
  }
  function fit() {
    const box = stage.getBoundingClientRect();
    size = Math.max(200, Math.floor(Math.min(box.width, box.height)-68));
    lens.style.width = lens.style.height = size+'px';
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(size*dpr);
    clamp();
  }
  function clamp() {
    cam.z = Math.min(zMax, Math.max(zMin(), cam.z));
    const limit = Math.max(0, R-size*.36/cam.z), d = Math.hypot(cam.x, cam.y);
    if (d > limit) {cam.x *= limit/d; cam.y *= limit/d;}
  }
  function flyTo(x, y, z, ms = 1100) {
    if (reduced) ms = 0;
    fly = {x0:cam.x, y0:cam.y, z0:cam.z, x, y, z:Math.min(zMax, Math.max(zMin(), z)), t0:performance.now(), ms};
    if (!ms) {cam = {x, y, z:fly.z}; clamp(); fly = null;}
  }

  const sparkle = (x, y, r) => {
    ctx.beginPath(); ctx.moveTo(x,y-r); ctx.quadraticCurveTo(x+r*.16,y-r*.16,x+r,y); ctx.quadraticCurveTo(x+r*.16,y+r*.16,x,y+r);
    ctx.quadraticCurveTo(x-r*.16,y+r*.16,x-r,y); ctx.quadraticCurveTo(x-r*.16,y-r*.16,x,y-r); ctx.fill();
  };
  const starPath = (x, y, r, turn = 0) => {
    ctx.beginPath();
    for (let n = 0; n < 10; n++) {
      const a = turn-Math.PI/2+n*Math.PI/5, d = n%2 ? r*.5 : r;
      if (n) ctx.lineTo(x+Math.cos(a)*d, y+Math.sin(a)*d); else ctx.moveTo(x+Math.cos(a)*d, y+Math.sin(a)*d);
    }
    ctx.closePath();
  };
  const inkStar = (x, y, r, fill, turn = 0, line = 2) => {
    ctx.lineJoin = 'round'; starPath(x,y,r,turn); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = line; ctx.stroke();
  };
  function label(text, x, y, {fontSize = 11, fill = TAG, line = '#564537', color = '#332b23'} = {}) {
    ctx.font = `700 ${fontSize}px system-ui,sans-serif`;
    const w = ctx.measureText(text).width+16, h = fontSize+9;
    ctx.fillStyle = fill; ctx.strokeStyle = line; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(x-w/2, y, w, h, h/2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y+h/2+.5);
  }

  function draw(now) {
    const t = now/1000, z = cam.z, half = size/2, r2 = (half+10)**2;
    const inside = (px, py, slack = 1) => (px-half)**2+(py-half)**2 <= r2*slack;
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.globalAlpha = 1; ctx.fillStyle = NIGHT; ctx.fillRect(0,0,size,size);
    {
      const px = sx(1180), py = sy(-1040), r = Math.max(11, 78*z);
      if ((px-half)**2+(py-half)**2 < (half+r*2)**2) {
        ctx.save(); ctx.beginPath(); ctx.arc(px,py,r,0,TAU); ctx.fillStyle = '#ffe9a8'; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.6, r*.07); ctx.stroke(); ctx.clip();
        ctx.beginPath(); ctx.arc(px+r*.48,py-r*.2,r*.92,0,TAU); ctx.fillStyle = NIGHT; ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    const k = .5+.5*Math.min(1.6, z), dim = Math.min(1, .5+z*.6);
    if (waiting.count) {
      ctx.fillStyle = GOLD; ctx.globalAlpha = WAITING*dim;
      for (let i = 0; i < waiting.count; i++) {
        const px = half+(waiting.x[i]-cam.x)*z, py = half+(waiting.y[i]-cam.y)*z, dx = px-half, dy = py-half;
        if (dx*dx+dy*dy > r2) continue;
        const d = Math.max(.9, waiting.size[i]*k*1.5);
        ctx.fillRect(px-d/2, py-d/2, d, d);
      }
    }
    for (let c = 0; c < COLORS.length; c++) {
      ctx.fillStyle = COLORS[c];
      for (let group = 0; group < 2; group++) {
        const list = buckets[c][group];
        ctx.globalAlpha = (group ? .95 : .6)*dim;
        for (let n = 0; n < list.length; n++) {
          const i = list[n], px = half+(anon.x[i]-cam.x)*z, py = half+(anon.y[i]-cam.y)*z, dx = px-half, dy = py-half;
          if (dx*dx+dy*dy > r2) continue;
          const d = Math.max(.8, anon.size[i]*k);
          if (d < 1.7) ctx.fillRect(px-d/2, py-d/2, d, d); else {ctx.beginPath(); ctx.arc(px,py,d/2,0,TAU); ctx.fill();}
        }
      }
    }
    ctx.fillStyle = PALE;
    for (let n = 0; n < bright.length; n++) {
      const i = bright[n], px = sx(anon.x[i]), py = sy(anon.y[i]);
      if (!inside(px,py)) continue;
      const wave = reduced ? .6 : .5+.5*Math.sin(t*1.6+anon.phase[i]);
      ctx.globalAlpha = .42+.28*wave; sparkle(px, py, Math.max(2.4, anon.size[i]*k*1.9)*(.72+.38*wave));
    }
    ctx.globalAlpha = 1;
    if (anon.constellation) {
      ctx.strokeStyle = PALE; ctx.globalAlpha = Math.min(.75, .3+z*.6); ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let i = 0; i < DUCK.length; i++) if (i) ctx.lineTo(sx(anon.x[i]), sy(anon.y[i])); else ctx.moveTo(sx(anon.x[i]), sy(anon.y[i]));
      ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1;
      const lx = sx(DUCK_AT[0]+3.9*DUCK_SIZE), ly = sy(DUCK_AT[1]+3.5*DUCK_SIZE);
      if (z > .3 && inside(lx,ly,.8)) label('The Great Duck', lx, ly, {fontSize:12});
    }
    const me = sky.me, mx = me ? sx(me.x) : 0, my = me ? sy(me.y) : 0;
    if (me && sky.friends.length) {
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.setLineDash([2,7]); ctx.beginPath();
      for (const friend of sky.friends) {ctx.moveTo(mx,my); ctx.lineTo(sx(friend.x), sy(friend.y));}
      ctx.stroke(); ctx.setLineDash([]);
    }
    const r = Math.max(2.6, 7.5*k*Math.min(1, .35+z)), lit = Math.max(5.5, r*1.35), named = [], glowing = [];
    const glow = (px, py, radius, phase, reach) => {
      const pulse = reduced ? .4 : (t*.6+phase)%1, wave = reduced ? .6 : .5+.5*Math.sin(t*2+phase);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.globalAlpha = 1-pulse; ctx.beginPath(); ctx.arc(px,py,radius+2+pulse*reach,0,TAU); ctx.stroke();
      ctx.globalAlpha = .9; ctx.fillStyle = PALE; sparkle(px, py, radius*(1.9+.25*wave)); ctx.globalAlpha = 1;
    };
    for (const star of sky.named) {
      if (star.me) continue;
      const px = sx(star.x), py = sy(star.y);
      if (!inside(px,py)) continue;
      if (star.online) glowing.push([star, px, py]);
      else {
        ctx.globalAlpha = OFFLINE;
        if (r < 3.6) {ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(px,py,r,0,TAU); ctx.fill();}
        else inkStar(px, py, r, GOLD, star.phase*.05, Math.max(1.4, r*.2));
        ctx.globalAlpha = 1;
      }
      if (star !== focus && (z >= .85 || (star.friend && z >= .5))) named.push([Math.hypot(px-half, py-half), star, px, py]);
    }
    for (const [star, px, py] of glowing) {glow(px, py, lit, star.phase, 14); inkStar(px, py, lit, GOLD, star.phase*.05, Math.max(1.4, lit*.2));}
    named.sort((a, b) => (b[1].friend-a[1].friend) || (b[1].online-a[1].online) || a[0]-b[0]);
    for (const [, star, px, py] of named.slice(0, 16)) label('@'+star.login, px, py+(star.online ? lit : r)+7);
    if (me && inside(mx,my,1.3)) {
      const mr = Math.max(9, 12*k);
      glow(mx, my, mr, 0, 20);
      inkStar(mx, my, mr, GOLD, 0, Math.max(2, mr*.2));
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.ellipse(mx-mr*.2, my-mr*.22, mr*.17, mr*.1, -.6, 0, TAU); ctx.fill();
      if (focus !== me) label('@'+me.login, mx, my+mr+9, {fontSize:12.5});
    }
    for (const [i, t0] of born) {
      const a = (now-t0)/1500;
      if (a >= 1 || i >= anon.count) {born.delete(i); continue;}
      const px = sx(anon.x[i]), py = sy(anon.y[i]);
      ctx.strokeStyle = PALE; ctx.globalAlpha = 1-a; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px,py,5+a*34,0,TAU); ctx.stroke(); ctx.globalAlpha = 1;
      inkStar(px, py, 7+3*(1-a), GOLD, a*1.2, 1.6);
    }
    if (!shooting && queue.length) {const i = queue.shift(); if (i < anon.count) shooting = {i, fx:size*(.1+Math.random()*.25), fy:-20, t0:now, ms:reduced ? 1 : 950};}
    if (shooting) {
      const a = Math.min(1, (now-shooting.t0)/shooting.ms), e = a*a*(3-2*a), ex = sx(anon.x[shooting.i]), ey = sy(anon.y[shooting.i]);
      const px = shooting.fx+(ex-shooting.fx)*e, py = shooting.fy+(ey-shooting.fy)*e, angle = Math.atan2(ey-shooting.fy, ex-shooting.fx);
      const length = 70*Math.sin(a*Math.PI)+18, nx = Math.cos(angle+Math.PI/2)*5, ny = Math.sin(angle+Math.PI/2)*5;
      ctx.beginPath(); ctx.moveTo(px+nx,py+ny); ctx.lineTo(px-Math.cos(angle)*length, py-Math.sin(angle)*length); ctx.lineTo(px-nx,py-ny); ctx.closePath();
      ctx.fillStyle = PALE; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
      inkStar(px, py, 9, GOLD, a*5, 1.8);
      if (a >= 1) {born.set(shooting.i, now); shooting = null;}
    }
    if (focus) placeTag();
  }
  function frame(now) {
    if (!running) return;
    if (fly) {
      const a = fly.ms ? Math.min(1, (now-fly.t0)/fly.ms) : 1, e = ease(a);
      cam.z = Math.exp(Math.log(fly.z0)+(Math.log(fly.z)-Math.log(fly.z0))*e);
      cam.x = fly.x0+(fly.x-fly.x0)*e; cam.y = fly.y0+(fly.y-fly.y0)*e; clamp();
      if (a >= 1) fly = null;
    }
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  function pick(px, py) {
    let best = null, distance = 22;
    for (const star of sky.named) {const d = Math.hypot(sx(star.x)-px, sy(star.y)-py); if (d < distance) {distance = d; best = star;}}
    if (best) return best;
    const wx = cam.x+(px-size/2)/cam.z, wy = cam.y+(py-size/2)/cam.z, cx = (wx+R)/CELL|0, cy = (wy+R)/CELL|0, reach = Math.max(1, Math.ceil(16/cam.z/CELL));
    let hit = -1; distance = 16;
    for (let gx = cx-reach; gx <= cx+reach; gx++) for (let gy = cy-reach; gy <= cy+reach; gy++) {
      for (const i of grid.get(gx*256+gy) ?? []) {const d = Math.hypot(sx(anon.x[i])-px, sy(anon.y[i])-py); if (d < distance) {distance = d; hit = i;}}
    }
    if (hit >= 0) return {anonymous:hit, x:anon.x[hit], y:anon.y[hit]};
    let wait = -1; distance = 12;
    for (let i = 0; i < waiting.count; i++) {const d = Math.hypot(sx(waiting.x[i])-px, sy(waiting.y[i])-py); if (d < distance) {distance = d; wait = i;}}
    return wait < 0 ? null : {waiting:wait, x:waiting.x[wait], y:waiting.y[wait]};
  }
  const same = (a, b) => a === b || (a && b && ((a.anonymous !== undefined && a.anonymous === b.anonymous) || (a.waiting !== undefined && a.waiting === b.waiting)));
  function show(star) {
    if (same(star, focus)) return;
    focus = star;
    if (!star) {tag.hidden = true; return;}
    if (star.waiting !== undefined) {
      tag.innerHTML = `<span>${starIcon(WAITING)}</span><div><b>Not lit yet</b><small>Waiting for someone to star Ente</small></div>`;
    } else if (star.anonymous !== undefined) {
      tag.innerHTML = `<span>${starIcon(OFFLINE)}</span><div><b>Star #${(sky.named.length+star.anonymous+1).toLocaleString('en')}</b><small>${star.anonymous < anon.constellation ? 'Part of the Great Duck' : 'Offline'}</small></div>`;
    } else {
      const about = star.me ? 'Your star' : [star.online ? 'Online now' : 'Offline', star.friend ? 'your friend' : ''].filter(Boolean).join(' · ');
      tag.innerHTML = `<span>${starIcon(star.online ? 1 : OFFLINE)}</span><div><b>@${escapeText(star.login)}</b><small>${about}</small></div>`;
    }
    tag.hidden = false; placeTag();
  }
  function placeTag() {
    const px = sx(focus.x), py = sy(focus.y);
    if ((px-size/2)**2+(py-size/2)**2 > (size/2)**2) {tag.hidden = true; return;}
    tag.hidden = false;
    tag.style.left = Math.min(size-70, Math.max(70, px))+'px'; tag.style.top = py+'px';
    tag.style.transform = py < 74 ? 'translate(-50%,18px)' : 'translate(-50%,calc(-100% - 18px))';
  }

  const points = new Map(), cleanups = [];
  let moved = 0, pinch = 0;
  const local = event => {const box = lens.getBoundingClientRect(); return [event.clientX-box.left, event.clientY-box.top];};
  const listen = (target, name, fn, options) => {target.addEventListener(name, fn, options); cleanups.push(() => target.removeEventListener(name, fn, options));};
  function zoomAt(px, py, factor) {
    const wx = cam.x+(px-size/2)/cam.z, wy = cam.y+(py-size/2)/cam.z;
    cam.z = Math.min(zMax, Math.max(zMin(), cam.z*factor));
    cam.x = wx-(px-size/2)/cam.z; cam.y = wy-(py-size/2)/cam.z; clamp();
  }
  listen(lens, 'pointerdown', event => {
    lens.setPointerCapture(event.pointerId); points.set(event.pointerId, local(event)); moved = 0; fly = null;
    if (points.size === 2) {const [a,b] = [...points.values()]; pinch = Math.hypot(a[0]-b[0], a[1]-b[1]);}
  });
  listen(lens, 'pointermove', event => {
    const p = local(event);
    if (!points.has(event.pointerId)) {if (event.pointerType === 'mouse' && !pinned) show(pick(p[0], p[1])); return;}
    const previous = points.get(event.pointerId); points.set(event.pointerId, p);
    if (points.size === 1) {
      cam.x -= (p[0]-previous[0])/cam.z; cam.y -= (p[1]-previous[1])/cam.z; moved += Math.abs(p[0]-previous[0])+Math.abs(p[1]-previous[1]);
      if (moved > 6) lens.classList.add('dragging');
      clamp();
    } else if (points.size === 2) {
      const [a,b] = [...points.values()], d = Math.hypot(a[0]-b[0], a[1]-b[1]);
      if (pinch) zoomAt((a[0]+b[0])/2, (a[1]+b[1])/2, d/pinch);
      pinch = d; moved = 99;
    }
  });
  const release = event => {
    if (!points.has(event.pointerId)) return;
    const p = local(event); points.delete(event.pointerId); lens.classList.remove('dragging'); pinch = 0;
    if (moved <= 6) {const star = pick(p[0], p[1]); pinned = Boolean(star); focus = undefined; show(star);}
  };
  listen(lens, 'pointerup', release); listen(lens, 'pointercancel', release);
  listen(lens, 'pointerleave', () => {if (!pinned) show(null);});
  listen(lens, 'wheel', event => {event.preventDefault(); fly = null; zoomAt(...local(event), Math.exp(-event.deltaY*.0016));}, {passive:false});
  listen(window, 'resize', () => {if (running) fit();});

  function findMe() {
    if (!sky.me) return;
    pinned = true; focus = undefined; show(sky.me); flyTo(sky.me.x, sky.me.y, 1.15, 1200);
  }
  return {
    start() {if (running) return; running = true; fit(); cam = {x:0, y:0, z:zMin()}; raf = requestAnimationFrame(frame);},
    setData(data) {
      const before = loaded ? sky.total : null;
      sky = readSky(data);
      const count = sky.total-sky.named.length;
      if (count !== anon.count) {const was = anon.count; anon = anonymousStars(count); index(); if (before !== null && sky.total > before) for (let i = Math.max(was, count-3); i < count; i++) queue.push(i);}
      if (before !== null && sky.total > before) onNews(`Someone just starred Ente. Star #${sky.total.toLocaleString('en')} is lit.`);
      if (focus && focus.anonymous === undefined && focus.waiting === undefined) {const again = sky.named.find(star => star.accountId === focus.accountId) ?? null; focus = undefined; show(again);}
      if (!loaded) {loaded = true; if (sky.me) setTimeout(() => {if (running) findMe();}, reduced ? 0 : 700);}
    },
    findMe,
    zoom(factor) {flyTo(cam.x, cam.y, cam.z*factor, 350);},
    whole() {pinned = false; show(null); flyTo(0, 0, zMin(), 900);},
    constellation() {
      const stars = [sky.me, ...sky.friends].filter(Boolean);
      if (stars.length < 2) return findMe();
      const xs = stars.map(star => star.x), ys = stars.map(star => star.y);
      const w = Math.max(...xs)-Math.min(...xs), h = Math.max(...ys)-Math.min(...ys);
      pinned = false; show(null);
      flyTo((Math.max(...xs)+Math.min(...xs))/2, (Math.max(...ys)+Math.min(...ys))/2, size*.72/Math.max(w, h, 200), 1100);
    },
    dispose() {running = false; cancelAnimationFrame(raf); for (const cleanup of cleanups) cleanup(); tag.hidden = true;},
  };
}
