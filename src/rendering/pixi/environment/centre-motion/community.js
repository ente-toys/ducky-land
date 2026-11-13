export function updateCommunityCentre(art, seconds, reducedMotion = false) {
  if (art?.id !== 'community') return;
  const flame = art.props.find(p => p.id === 'campfire-flame');
  if (!flame?.sprite || !flame.sprite.visible) return;
  const s = flame.sprite;
  const hearth = art.props.find(p => p.id === 'campfire');
  if (!hearth?.sprite) return;
  const breath = reducedMotion ? 0 : Math.sin(seconds * 6.2) * .032 + Math.sin(seconds * 10.7 + .6) * .013;
  if (s.texture) {
    const x = hearth.sprite.width / s.texture.width;
    const y = hearth.sprite.height / s.texture.height;
    s.position.set(hearth.sprite.x, hearth.sprite.y +
      (flame.anchor.y - hearth.anchor.y) * hearth.sprite.height);
    s.scale.set(x * (1 - breath * .6), y * (1 + breath));
  } else {
    const rest = s.centreRest ??= {sx:s.scale.x, sy:s.scale.y};
    s.scale.set(rest.sx * (1 - breath * .6), rest.sy * (1 + breath));
  }
  s.skew.x = reducedMotion ? 0 : Math.sin(seconds * 4.1) * .018;
  s.alpha = reducedMotion ? 1 : .97 + Math.sin(seconds * 7.3) * .03;
  s.zIndex = flame.sortY;
}
