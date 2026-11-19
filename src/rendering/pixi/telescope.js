export const TELESCOPE_REACH = 260;
const isTelescope = prop => /telescope/i.test(prop.asset || prop.name || '');
const SPOTS = new WeakMap();

export function telescopeSpot(prop) {
  const scale = prop.scale ?? 1;
  return {id:prop.id ?? prop.name, x:prop.x-119*scale, y:prop.y+(prop.telescopeOffsetY ?? -36)*scale, turn:Math.PI/2};
}

export function telescopeSpots(props) {
  if (!Array.isArray(props) || !props.length) return [];
  if (!SPOTS.has(props)) SPOTS.set(props, props.filter(isTelescope).map(telescopeSpot));
  return SPOTS.get(props);
}

export function telescopeNear(props, pose, reach = TELESCOPE_REACH) {
  if (!pose || pose.mode === 'sailing') return null;
  let best = null, distance = reach;
  for (const spot of telescopeSpots(props)) {
    const d = Math.hypot(spot.x-pose.x, spot.y-pose.y);
    if (d <= distance) {best = spot; distance = d;}
  }
  return best;
}

export function telescopePeerAt(props, pose) {
  if (!pose || pose.mode === 'sailing' || pose.action !== 0 || pose.travel > 3 || pose.jumpLeft > 0) return null;
  for (const spot of telescopeSpots(props)) {
    if (((pose.x-spot.x)/42)**2 + ((pose.y-spot.y)/28)**2 <= 1) return spot;
  }
  return null;
}

// Some telescopes stand where their look spot is blocked, so the walk ends a step short.
// Once the Ducky has stopped beside one, it is there: open the sky straight away.
export const TELESCOPE_STOP = 140;
export function telescopeArrived(props, pose, spot) {
  if (telescopePeerAt(props, pose)) return true;
  if (!pose || !spot || pose.mode === 'sailing' || pose.path?.length || (pose.travel ?? 0) > 3) return false;
  return Math.hypot(spot.x-pose.x, spot.y-pose.y) <= TELESCOPE_STOP;
}
