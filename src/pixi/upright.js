// New children may be sized after insertion. Apply the tilt correction once, at the next frame,
// rather than walking every loaded island's thousands of children on every frame.
export function trackUpright(layers, tilt) {
  const pending = new Set();
  const listeners = layers.map(([layer, standingOnly = false]) => {
    const added = child => pending.add(child);
    layer.on('childAdded', added);
    for (const child of layer.children) added(child);
    return {layer, standingOnly, added};
  });
  return {
    update() {
      for (const child of pending) {
        const owner = listeners.find(({layer}) => child.parent === layer);
        if (owner && !child.upright && (!owner.standingOnly || child.standing)) {
          child.upright = true;
          child.scale.y /= tilt;
        }
      }
      pending.clear();
    },
    destroy() {
      for (const {layer, added} of listeners) layer.off('childAdded', added);
      pending.clear();
    },
  };
}
