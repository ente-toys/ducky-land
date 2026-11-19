import {flatRigid, unplaceRigid} from '../../world/rigid.js';

export function withRigidVisitors(from, to, objects, draw, reference = null) {
  if (!objects.length) return draw();
  const frame = flatRigid(from, to, reference);
  const angle = Math.atan2(frame.b, frame.a), flip = frame.d < 0 ? -1 : 1;
  const actors = new Set(objects);
  const masks = objects.map(o => o.mask).filter(mask => mask?.position && !actors.has(mask));
  for (const mask of masks) {
    let parent = mask.parent;
    while (parent && !actors.has(parent)) parent = parent.parent;
    if (!parent) actors.add(mask);
  }
  const saved = [...actors].map(o => ({o, x:o.x, y:o.y, rotation:o.rotation, z:o.zIndex, visible:o.visible, sy:o.scale.y, skewX:o.skew.x, skewY:o.skew.y}));
  try {
    for (const {o, y, z, rotation, sy, skewX, skewY} of saved) {
      const p = unplaceRigid(from, to, o, reference ?? o);
      o.position.set(p.x, p.y);
      o.rotation = flip * (rotation - angle);
      o.scale.y = flip * sy;
      o.skew.set(flip * skewX, flip * skewY);
      o.zIndex = p.y + flip * (z - y);
      if (objects.includes(o)) o.visible = true;
    }
    return draw();
  } finally {
    for (const {o, x, y, rotation, z, visible, sy, skewX, skewY} of saved) {
      o.position.set(x, y);
      o.rotation = rotation;
      o.scale.y = sy;
      o.skew.set(skewX, skewY);
      o.zIndex = z;
      o.visible = visible;
    }
  }
}
