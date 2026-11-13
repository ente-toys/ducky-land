import {stepRink} from './rink-slide.js';
export const WALK_SPEED = 245;
export const RUN_FACTOR = 1.7, RUN_SPEED = WALK_SPEED * RUN_FACTOR;
export const MUSEUM_DOOR = {x0: 2850, x1: 2990, y: 1215, out: {x: 2920, y: 1340}};
export const atMuseumDoor = (x, y) => x > MUSEUM_DOOR.x0 && x < MUSEUM_DOOR.x1 && y < MUSEUM_DOOR.y;
export const JUMP_SECONDS = .6;

export function startJump(actor) {
  if (!actor || actor.mode === 'sailing' || actor.jumpLeft > 0) return false;
  actor.jumpLeft = JUMP_SECONDS;
  if (actor.action > 1) {actor.action = 0; actor.until = 0;}
  return true;
}

export const JUMP_CROUCH = .08, JUMP_LAND = .14, JUMP_AIR = JUMP_SECONDS - JUMP_CROUCH - JUMP_LAND, JUMP_RISE = 85;
const REST = Object.freeze({lift:0, sx:1, sy:1, rotation:0, shadow:0, shadowScale:1, phase:'ground'});
const clamp01 = v => Math.max(0, Math.min(1, v));

export function jumpPose(left = 0, reduced = false, {turn = 0, moving = false} = {}) {
  if (!(left > 0)) return REST;
  const t = JUMP_SECONDS - Math.min(left, JUMP_SECONDS), rise = reduced ? 15 : JUMP_RISE;
  const lean = moving ? Math.max(-1, Math.min(1, Math.sin(turn) * 1.6)) : (Math.sin(turn) < 0 ? -.4 : .4);
  if (t < JUMP_CROUCH) {
    const k = 1 - (1 - t / JUMP_CROUCH) ** 2;
    return reduced ? {...REST, phase:'crouch'} : {lift:0, sx:1 + .2 * k, sy:1 - .24 * k, rotation:-lean * .05 * k, shadow:.26 * k, shadowScale:1, phase:'crouch'};
  }
  if (t < JUMP_CROUCH + JUMP_AIR) {
    const u = (t - JUMP_CROUCH) / JUMP_AIR, h = 4 * u * (1 - u), lift = h * rise;
    if (reduced) return {...REST, lift, phase:'air'};
    const up = u < .5 ? (1 - u / .5) ** 2 : 0, down = u > .5 ? ((u - .5) / .5) ** 2 : 0;
    const pop = clamp01((t - JUMP_CROUCH) / .03);
    const sy = 1 - .24 * (1 - pop) + (.26 * up + .1 * down) * pop, sx = 1 + .2 * (1 - pop) - (.16 * up + .06 * down) * pop;
    return {lift, sx, sy, rotation:lean * (.05 + .13 * u) * Math.sin(Math.PI * u), shadow:.26 * (1 - .7 * h), shadowScale:1 - .45 * h, phase:'air'};
  }
  const v = clamp01((t - JUMP_CROUCH - JUMP_AIR) / JUMP_LAND), a = (1 - v) * Math.exp(-3 * v) * Math.cos(2.4 * Math.PI * v);
  return reduced ? {...REST, phase:'land'} : {lift:0, sx:1 + .26 * a, sy:1 - .3 * a, rotation:0, shadow:.26 * (1 - v), shadowScale:1 + .08 * a, phase:'land'};
}

export function jumpHeight(left = 0, reduced = false) {
  return jumpPose(left, reduced).lift;
}
export const DURATIONS = {2:1.3,3:6,4:1.5,5:1.55,6:1.55,7:2.3,8:1.5,9:1.75};
export const EASE_IN = .1, EASE_OUT = .12, DUCK_RADIUS = 22;
const BRAKE = WALK_SPEED / EASE_OUT, CREEP = 30, SIDE = Math.PI / 18;

export function setWalkDestination(actor, nav, x, y) {
  actor.path = nav.route(actor.x, actor.y, x, y);
  if (!actor.path.length) return null;
  actor.action = 1;
  actor.until = 0;
  actor.heading = null;
  return actor.path.at(-1);
}

// Quack and dance work on a boat too: they only play the animation and never touch the course or heading.
export const SAIL_EMOTES = new Set([2, 3]);
export function playSailEmote(actor, action, now) {
  if (!SAIL_EMOTES.has(action)) return false;
  if (action === 3 && actor.action === 3) {actor.action = 0; actor.until = 0; return true;}
  actor.action = action;
  actor.until = now + DURATIONS[action];
  actor.emoteVersion = (actor.emoteVersion ?? 0) + 1;
  return true;
}
export function playEmote(actor, action, now) {
  actor.path = [];
  actor.travel = 0;
  actor.pace = 0;
  if (action === 3 && actor.action === 3) {
    actor.action = 0;
    actor.until = 0;
    return;
  }
  actor.action = action;
  actor.turn = 0;
  actor.until = now + DURATIONS[action];
  actor.emoteVersion++;
}

export function slideStep(nav, x, y, vx, vy) {
  const s = Math.hypot(vx, vy), from = [x, y];
  if (!s || nav.clearLine(from, [x+vx, y+vy])) return [x+vx, y+vy];
  let ox = 0, oy = 0;
  const r = Math.max(10, s+4);
  for (let i = 0; i < 16; i++) {const a = i*Math.PI/8, c = Math.cos(a), n = Math.sin(a); if (nav.walkable(x+c*r, y+n*r)) {ox += c; oy += n;}}
  const open = Math.hypot(ox, oy);
  if (open > 1.5 && Math.abs(vx*oy-vy*ox) < Math.sin(SIDE)*s*open && vx*ox+vy*oy < 0) return from;
  for (let k = 1; k <= 7; k++) {
    const len = Math.cos(k*SIDE);
    const options = [1, -1].map(sign => {const c = Math.cos(sign*k*SIDE), n = Math.sin(sign*k*SIDE), dx = (vx*c-vy*n)*len, dy = (vx*n+vy*c)*len;
      return {dx, dy, open:nav.clearLine(from, [x+dx, y+dy]), lean:dx*ox+dy*oy};}).filter(o => o.open);
    if (!options.length) continue;
    if (options.length === 2 && Math.abs(options[0].lean-options[1].lean) < 1e-6*s) return from;
    const best = options.length === 1 || options[0].lean > options[1].lean ? options[0] : options[1];
    return [x+best.dx, y+best.dy];
  }
  return from;
}

export function walkStep(actor, nav, dt, now, input) {
  actor.jumpLeft = Math.max(0, (actor.jumpLeft ?? 0) - dt);
  actor.previousX = actor.x;
  actor.previousY = actor.y;
  actor.travel = 0;
  if (stepRink(actor,nav,dt,input,slideStep)) return;
  const manual = input.x !== 0 || input.y !== 0;
  if (manual) {
    actor.path = [];
    actor.until = 0;
  }
  if (now < actor.until) { actor.pace = 0; return; }
  const next = actor.path[0], coast = !manual && !next && actor.heading && actor.pace > 0;
  const dx = manual ? input.x : next ? next[0] - actor.x : coast ? actor.heading[0] : 0;
  const dy = manual ? input.y : next ? next[1] - actor.y : coast ? actor.heading[1] : 0;
  const distance = Math.hypot(dx, dy);
  if (!distance) {
    if (next) actor.path.shift();
    actor.pace = 0;
    actor.action = 0;
    return;
  }
  const before = actor.pace || 0, top = manual && input.run === true ? RUN_SPEED : WALK_SPEED;
  let pace;
  if (coast) pace = Math.max(0, before - (before > WALK_SPEED ? RUN_SPEED/EASE_OUT : BRAKE)*dt);
  else if (before > top) pace = Math.max(top, before - (RUN_SPEED-WALK_SPEED)/EASE_OUT*dt);
  else pace = Math.min(top, before + top/EASE_IN*dt);
  if (next) {
    let left = distance;
    for (let i = 1; i < actor.path.length; i++) left += Math.hypot(actor.path[i][0]-actor.path[i-1][0], actor.path[i][1]-actor.path[i-1][1]);
    pace = Math.min(pace, Math.max(CREEP, Math.sqrt((BRAKE*dt)**2 + 2*BRAKE*left) - BRAKE*dt));
  }
  const step = (pace > before ? (before + pace) / 2 : pace) * dt;
  const origin = [actor.x, actor.y];
  if (manual || coast) {
    actor.heading = [dx/distance, dy/distance];
    [actor.x, actor.y] = slideStep(nav, actor.x, actor.y, dx/distance*step, dy/distance*step);
  } else {
    actor.heading = null;
    let left = step;
    while (left > 1e-9 && actor.path.length) {
      const [px, py] = actor.path[0], gap = Math.hypot(px-actor.x, py-actor.y);
      if (gap <= left && nav.clearLine([actor.x, actor.y], [px, py])) { actor.x = px; actor.y = py; actor.path.shift(); left -= gap; continue; }
      const t = Math.min(1, left/(gap || 1)), wish = [(px-actor.x)*t, (py-actor.y)*t];
      const [x, y] = slideStep(nav, actor.x, actor.y, ...wish);
      if (Math.hypot(x-actor.x, y-actor.y) < left*.25) actor.path = [];
      actor.x = x; actor.y = y;
      break;
    }
    if (!actor.path.length && Math.hypot(actor.x-origin[0], actor.y-origin[1]) < step*.25) pace = 0;
  }
  actor.pace = actor.path.length || manual || coast ? pace : 0;
  const turn = Math.atan2(dx,dy);
  const delta = Math.atan2(Math.sin(turn-actor.turn), Math.cos(turn-actor.turn));
  actor.turn += delta * (1 - Math.exp(-13 * dt));
  actor.travel = Math.hypot(actor.x-origin[0], actor.y-origin[1]) / dt;
  actor.action = actor.travel > .001 ? 1 : 0;
}

export function separateActors(actors, nav, dt) {
  const space = DUCK_RADIUS*2, most = 260*dt;
  let moved = false;
  const nudge = (d, x, y) => {
    if (!x && !y) return;
    const to = [d.x+x, d.y+y];
    if (!nav.clearLine([d.x, d.y], to)) return;
    d.x = to[0]; d.y = to[1]; moved = true;
  };
  for (let i = 0; i < actors.length; i++) for (let j = i+1; j < actors.length; j++) {
    const a = actors[i], b = actors[j];
    if (a.sleeping && b.sleeping) continue;
    let dx = b.x-a.x, dy = b.y-a.y, d = Math.hypot(dx, dy);
    if (d >= space) continue;
    if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
    const nx = dx/d, ny = dy/d, push = Math.min(space-Math.hypot(b.x-a.x, b.y-a.y), most);
    for (const [me, other] of [[a, b], [b, a]]) {
      if (me.path?.length === 1 && Math.hypot(me.path[0][0]-other.x, me.path[0][1]-other.y) < space) me.path = [];
    }
    const closing = ((b.x-b.previousX)-(a.x-a.previousX))*nx + ((b.y-b.previousY)-(a.y-a.previousY))*ny < 0;
    const side = closing ? push*.6 : 0, wa = a.sleeping ? 0 : b.sleeping ? 1 : .5, wb = 1-wa;
    nudge(a, (-nx*push - ny*side)*wa, (-ny*push + nx*side)*wa);
    nudge(b, (nx*push + ny*side)*wb, (ny*push - nx*side)*wb);
  }
  return moved;
}
