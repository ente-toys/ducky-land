export function sampleGlobeSpin(previous, dx, dy, elapsedMs) {
  const gap = Math.max(1, elapsedMs), alpha = -Math.expm1(-gap / 24);
  return {
    x: (previous?.x ?? 0) + (dx / gap - (previous?.x ?? 0)) * alpha,
    y: (previous?.y ?? 0) + (dy / gap - (previous?.y ?? 0)) * alpha,
  };
}

export function coastGlobeSpin(spin, dt) {
  const decay = Math.exp(-dt / .45), distance = -Math.expm1(-dt / .45) * .45 * 1000;
  return {dx: spin.x * distance, dy: spin.y * distance, x: spin.x * decay, y: spin.y * decay};
}
