// Offline boats (the ?offline dev mode): the ten moorings of the island, drawn from the offline fleet in room-client.js.
// Each boat bobs and rocks at its mooring, nose out. The boat is the wooden sailboat the boss picked.
import {Container, Sprite, Texture} from 'pixi.js';
import {loadBoatViews} from './boat-views.js';
import {OfflineFleet} from './room-client.js';


// boss 5 Nov: the picked design is the wooden sailboat off the boat sheet (concepts/boats, design 1), cut out to public/pixi-art
const BOAT_W = 188;   // boss 5 Nov: 50% bigger again (was 125)
// boss 5 Nov ("very blurry and shaky"): the sailboat SVG is rasterised once at 1.5x (sharp when zoomed in on a 2x screen) with
// mipmaps, so drawn small, rolling and moving it is smoothed down instead of sparkling. The live boats load the same asset.
export const BOAT_ART = {src: '/pixi-art/boat-sail.svg', data: {resolution: 1.5, autoGenerateMipmaps: true}};
// boss 5 Nov: moored boats show the turntable view for their mooring heading (boat-views.js), drawn at BOAT_W/255 of the live size
let boatViews = null;
const viewsReady = loadBoatViews().then(v => (boatViews = v)).catch(() => null);
function drawBoat(heading) {
  const root = new Container({label: 'Moored boat'}), boat = new Sprite(Texture.EMPTY);
  boat.anchor.set(.5, .82);
  const fit = v => {const view = v.pick(heading); v.apply(boat, view, BOAT_W / 255);};
  if (boatViews) fit(boatViews); else viewsReady.then(v => v && fit(v));
  root.addChild(boat);
  return {root, boat};
}

// boss 6 Nov ("I took the boat already. Every island should have all the boats"): offline shows the same ten moorings
// the room server fills (3 harbor, 3 islet, 4 beach; islands.js boatSpots), kept by the offline fleet in room-client.js.
// Each frame it follows the fleet: a refilled mooring's boat fades and bobs in over 0.4 s, a boat that leaves the list
// drifts astern and fades. The old arguments (islets, centre, coast) are unused now and kept for the engine's call.
const BORN = .4, BOB_PX = 10, DRIFT = .9, DRIFT_PX = 36;
const smooth = u => u * u * (3 - 2 * u);
const bobIn = k => k >= 1 ? 0 : (1 - k) ** 2 * Math.cos(k * Math.PI * 1.5);
export function createMooredBoats(layer, islets, island, {fleet = new OfflineFleet(), islandId = 'home'} = {}, seed = Math.floor(Math.random() * 1e9)) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const shown = new Map(), leaving = [];
  let settled = false;
  const sync = (now, reduced) => {
    const list = fleet.boats(islandId).filter(boat => !boat.occupant), ids = new Set(list.map(boat => boat.id));
    for (const [id, b] of shown) if (!ids.has(id)) {
      shown.delete(id);
      if (reduced) b.root.destroy({children: true}); else {b.leaving = now; leaving.push(b);}
    }
    const fresh = list.filter(boat => !shown.has(boat.id));
    for (const boat of fresh) {
      const b = drawBoat(boat.turn); b.root.position.set(boat.x, boat.y); layer.addChild(b.root);
      Object.assign(b, {x: boat.x, y: boat.y, turn: boat.turn, phase: rnd() * 6.28, born: settled && !reduced && fresh.length <= 2 ? now : 0});
      if (b.born) b.root.alpha = 0;
      shown.set(boat.id, b);
    }
    settled = true;
  };
  sync(0, true);
  return {
    get count() { return shown.size; },
    fleet,
    update(t, reduced, visible) {
      sync(t, reduced);
      for (let i = leaving.length - 1; i >= 0; i--) {
        const b = leaving[i], u = (t - b.leaving) / DRIFT;
        if (u >= 1) {b.root.destroy({children: true}); leaving.splice(i, 1); continue;}
        const d = (1 - (1 - u) ** 2) * DRIFT_PX;
        b.root.position.set(b.x - Math.sin(b.turn) * d, b.y - Math.cos(b.turn) * d * .45);
        b.root.alpha = 1 - smooth(u);
      }
      for (const b of shown.values()) {
        b.root.visible = visible(b.x, b.y, 120);
        if (!b.root.visible) continue;
        b.root.y = b.y + (reduced ? 0 : Math.sin(t * 1.4 + b.phase) * 2.5);
        b.boat.rotation = reduced ? 0 : Math.sin(t * 1.1 + b.phase) * .05;
        if (b.born) {
          const k = Math.min(1, (t - b.born) / BORN);
          b.root.alpha = smooth(Math.min(1, k * 1.4)); b.root.y += BOB_PX * bobIn(k);
          if (k >= 1) {b.born = 0; b.root.alpha = 1;}
        }
      }
    },
  };
}
