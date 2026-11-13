const MIN_WEIGHT = .01;

export function blendBoatViews(state, target, now, duration, reduced = false) {
  let buffer = state.weights;
  if (!buffer) buffer = state.weights = {keys: [null, null], values: new Float64Array(2), count: 0};
  if (!buffer.count || reduced || duration <= 0) {
    state.target = target; state.fading = false;
    buffer.keys[0] = target; buffer.values[0] = 1;
    buffer.keys[1] = null; buffer.values[1] = 0; buffer.count = 1;
  } else {
    if (target !== state.target) {
      let targetWeight = 0, source = null, sourceWeight = -1;
      for (let i = 0; i < buffer.count; i++) {
        if (buffer.keys[i] === target) targetWeight = buffer.values[i];
        else if (buffer.values[i] > sourceWeight) {source = buffer.keys[i]; sourceWeight = buffer.values[i];}
      }
      state.source = source; state.startTargetWeight = targetWeight;
      state.target = target; state.fadeStart = now; state.fadeDuration = duration;
      state.fading = source !== null;
    }
    if (state.fading) {
      const u = Math.max(0, Math.min(1, (now - state.fadeStart) / state.fadeDuration));
      let to = state.startTargetWeight + (1 - state.startTargetWeight) * (1 - (1 - u) ** 3);
      let from = 1 - to;
      if (from < MIN_WEIGHT) {from = 0; to = 1; state.fading = false;}
      else if (to < MIN_WEIGHT) {from = 1; to = 0;}
      buffer.keys[0] = from ? state.source : target; buffer.values[0] = from || to;
      buffer.keys[1] = from && to ? target : null; buffer.values[1] = from && to ? to : 0;
      buffer.count = from && to ? 2 : 1;
    }
  }
  state.blending = buffer.count === 2;
  return buffer;
}

export function boatPin(x, y, bob, rider) {return {x: x + rider.x, y: y + bob + rider.y};}
