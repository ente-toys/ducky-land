// The stargazing telescope (home-review/hill/telescope.svg) is drawn 190 x 225 with its feet on the prop's anchor. Its
// eyepiece is the blue cap at the lower left end of the tube, 75 left of and 126 above the feet. A Ducky's eye is 39 right
// of and 90 above its own feet when it faces right, so the Ducky that stands at the spot below has its eye on the eyepiece.
// Pure presentation, like bench-seat.js: multiplayer and walking coordinates remain authoritative.
export const TELESCOPE_REACH = 260;
const isTelescope = prop => /telescope/i.test(prop.asset || prop.name || '');
const SPOTS = new WeakMap();

export function telescopeSpot(prop) {
  const scale = prop.scale ?? 1;
  return {id:prop.id ?? prop.name, x:prop.x-119*scale, y:prop.y-36*scale, turn:Math.PI/2};
}

// Every telescope on a map, found once per prop list (a themed island has well over a thousand props).
export function telescopeSpots(props) {
  if (!Array.isArray(props) || !props.length) return [];
  if (!SPOTS.has(props)) SPOTS.set(props, props.filter(isTelescope).map(telescopeSpot));
  return SPOTS.get(props);
}

// The telescope a walking Ducky is close enough to use, nearest first.
export function telescopeNear(props, pose, reach = TELESCOPE_REACH) {
  if (!pose || pose.mode === 'sailing') return null;
  let best = null, distance = reach;
  for (const spot of telescopeSpots(props)) {
    const d = Math.hypot(spot.x-pose.x, spot.y-pose.y);
    if (d <= distance) {best = spot; distance = d;}
  }
  return best;
}

// A Ducky that has walked to the eyepiece and paused looks through it: it faces the tube and stands exactly on the spot.
export function telescopePeerAt(props, pose) {
  if (!pose || pose.mode === 'sailing' || pose.action !== 0 || pose.travel > 3 || pose.jumpLeft > 0) return null;
  for (const spot of telescopeSpots(props)) {
    if (((pose.x-spot.x)/42)**2 + ((pose.y-spot.y)/28)**2 <= 1) return spot;
  }
  return null;
}
