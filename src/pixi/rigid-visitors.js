import {flatRigid, unplaceRigid} from './rigid.js';

// A live neighbour is rendered in its own chart and then rotated onto the map.
// Move visitors into that chart, but undo its turn on their artwork. Otherwise
// a boat and its rider tip sideways as soon as they enter the neighbour's pass.
export function withRigidVisitors(from, to, objects, draw) {
  if (!objects.length) return draw();
  const frame = flatRigid(from, to);
  const angle = Math.atan2(frame.b, frame.a);
  const actors = new Set(objects);
  const masks = objects.map(o => o.mask).filter(mask => mask?.position && !actors.has(mask));
  // A mask below an actor already inherits the actor's correction.
  for (const mask of masks) {
    let parent = mask.parent;
    while (parent && !actors.has(parent)) parent = parent.parent;
    if (!parent) actors.add(mask);
  }
  const saved = [...actors].map(o => ({o, x:o.x, y:o.y, rotation:o.rotation, z:o.zIndex, visible:o.visible}));
  try {
    for (const {o, y, z, rotation} of saved) {
      const p = unplaceRigid(from, to, o);
      o.position.set(p.x, p.y);
      o.rotation = rotation - angle;
      o.zIndex = z + p.y - y;
      if (objects.includes(o)) o.visible = true;
    }
    return draw();
  } finally {
    for (const {o, x, y, rotation, z, visible} of saved) {
      o.position.set(x, y);
      o.rotation = rotation;
      o.zIndex = z;
      o.visible = visible;
    }
  }
}
