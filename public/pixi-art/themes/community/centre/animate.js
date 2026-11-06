// Theme-owned animation adapter. Call after the engine's wind/culling pass.
// `art` is the result of loadThemeArt, `seconds` is absolute scene time.
export function updateCommunityCentre(art, seconds, reducedMotion = false) {
  if (art?.id !== 'community') return;
  const flame = art.props.find(p => p.id === 'campfire-flame');
  if (!flame?.sprite || !flame.sprite.visible) return;
  const s = flame.sprite;
  const hearth = art.props.find(p => p.id === 'campfire');
  if (!hearth?.sprite) return;
  // Match the hearth's actual size, including the engine's upright camera correction.
  const x = hearth.sprite.width / s.texture.width;
  const y = hearth.sprite.height / s.texture.height;
  s.position.set(hearth.sprite.x, hearth.sprite.y +
    (flame.anchor.y - hearth.anchor.y) * hearth.sprite.height);
  const breath = reducedMotion ? 0 : Math.sin(seconds * 6.2) * .032 + Math.sin(seconds * 10.7 + .6) * .013;
  s.scale.set(x * (1 - breath * .6), y * (1 + breath));
  s.skew.x = reducedMotion ? 0 : Math.sin(seconds * 4.1) * .018;
  s.alpha = reducedMotion ? 1 : .97 + Math.sin(seconds * 7.3) * .03;
  s.zIndex = flame.sortY;
}
