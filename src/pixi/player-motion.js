export const WALK_SPEED = 245;
export const DURATIONS = {2:1.3,3:6,4:1.5,5:1.55,6:1.55,7:2.3,8:1.5,9:1.75};

export function setWalkDestination(actor, nav, x, y) {
  actor.path = nav.route(actor.x, actor.y, x, y);
  if (!actor.path.length) return null;
  actor.action = 1;
  actor.until = 0;
  return actor.path.at(-1);
}

export function playEmote(actor, action, now) {
  actor.path = [];
  actor.travel = 0;
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

// Used by both the server and local prediction, with time measured in seconds.
export function walkStep(actor, nav, dt, now, input) {
  actor.previousX = actor.x;
  actor.previousY = actor.y;
  actor.travel = 0;
  const manual = input.x !== 0 || input.y !== 0;
  if (manual) {
    actor.path = [];
    actor.until = 0;
  }
  if (now < actor.until) return;
  const next = actor.path[0];
  const dx = manual ? input.x : next ? next[0] - actor.x : 0;
  const dy = manual ? input.y : next ? next[1] - actor.y : 0;
  const distance = Math.hypot(dx, dy);
  if (!distance) {
    if (next) actor.path.shift();
    actor.action = 0;
    return;
  }
  const travel = manual ? WALK_SPEED * dt : Math.min(WALK_SPEED * dt, distance);
  const x = actor.x + dx / distance * travel;
  const y = actor.y + dy / distance * travel;
  const origin = [actor.x, actor.y];
  if (nav.clearLine(origin, [x, y])) {
    actor.x = x;
    actor.y = y;
  } else if (manual && nav.clearLine(origin, [x, actor.y])) {
    actor.x = x;
  } else if (manual && nav.clearLine(origin, [actor.x, y])) {
    actor.y = y;
  } else {
    actor.path = [];
  }
  if (!manual && next && travel === distance && Math.hypot(actor.x-next[0],actor.y-next[1]) < .01) {
    actor.path.shift();
  }
  const turn = Math.atan2(dx,dy);
  const delta = Math.atan2(Math.sin(turn-actor.turn), Math.cos(turn-actor.turn));
  actor.turn += delta * (1 - Math.exp(-13 * dt));
  actor.travel = Math.hypot(actor.x-origin[0], actor.y-origin[1]) / dt;
  actor.action = actor.travel > .001 ? 1 : 0;
}
