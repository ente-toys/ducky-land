import {Container, Graphics} from 'pixi.js';

export const SNOW_POOL_SIZE = 180;
export const SNOW_PHONE_COUNT = 90;
export function snowVisible(theme, reduced, flat = true) {
  return theme === 'snow' && !reduced && flat;
}
const wrap = (x, span) => ((x % span) + span) % span;
export function snowPose(index, time, width, height, out = {}) {
  const depth = index % 12, layer = depth === 0 ? 2 : depth < 5 ? 1 : 0;
  const size = layer === 2 ? 8 : layer === 1 ? 5 : 2.5;
  const speed = (layer === 2 ? 32 : layer === 1 ? 22 : 10) * (.82 + (index * 17 % 29) / 80);
  const pad = 48, sway = Math.sin(time * (.27 + layer * .045) + index * 2.4) * (10 + layer * 7);
  const wind = time * (3 + layer * 2) + Math.sin(time * .11) * 18;
  out.x = wrap(index * 137.57 + wind + sway, Math.max(1, width + pad * 2)) - pad;
  out.y = wrap(index * 83.31 + time * speed, Math.max(1, height + pad * 2)) - pad;
  out.size = size;
  out.rotation = index % 24 === 0
    ? index * .7 + time * (index % 48 === 0 ? .06 : -.06) + Math.sin(time * .4 + index) * .12 : 0;
  return out;
}

function silhouette(g, shaped, x, y, scale, color, alpha) {
  if (!shaped) return g.circle(x, y, .46 * scale).fill({color, alpha});
  const step = Math.PI / 3;
  g.moveTo(x + Math.cos(-step / 2) * .14 * scale, y + Math.sin(-step / 2) * .14 * scale);
  for (let arm = 0; arm < 6; arm++) {
    const a = arm * step;
    g.lineTo(x + Math.cos(a - .12) * .4 * scale, y + Math.sin(a - .12) * .4 * scale)
      .quadraticCurveTo(x + Math.cos(a) * .54 * scale, y + Math.sin(a) * .54 * scale,
        x + Math.cos(a + .12) * .4 * scale, y + Math.sin(a + .12) * .4 * scale)
      .lineTo(x + Math.cos(a + step / 2) * .14 * scale, y + Math.sin(a + step / 2) * .14 * scale);
  }
  return g.closePath().fill({color, alpha});
}

function flakeTemplate(color, shaped = false) {
  const g = new Graphics();
  silhouette(g, shaped, .055, .10, 1.06, 0xc9d6e6, .08);
  silhouette(g, shaped, .035, .065, 1, 0xc9d6e6, .12);
  silhouette(g, shaped, 0, 0, 1.04, color, .16);
  return silhouette(g, shaped, 0, 0, 1, color, 1);
}

export function createSnowfall(stage) {
  const root = new Container({label: 'Iceland snowfall', eventMode: 'none'});
  const templates = [flakeTemplate(0xffffff), flakeTemplate(0xf5f8fd),
    flakeTemplate(0xedf3fb), flakeTemplate(0xe8f0fa),
    flakeTemplate(0xffffff, true), flakeTemplate(0xedf3fb, true)];
  const flakes = Array.from({length: SNOW_POOL_SIZE}, (_, i) => {
    const shaped = i % 24 === 0;
    const s = new Graphics(templates[shaped ? 4 + (i / 24 % 2) : (i * 7 + Math.floor(i / 12)) % 4].context);
    s.label = shaped ? 'Six-arm snowflake' : 'Round snowflake';
    s.alpha = i % 12 === 0 ? .9 : i % 12 < 5 ? .7 : .52;
    root.addChild(s); return s;
  });
  const pose = {};
  stage.addChild(root); root.visible = false;
  return {root, update(time, reduced, theme, width, height, flat) {
    root.visible = snowVisible(theme, reduced, flat); if (!root.visible) return;
    const count = width < 600 ? SNOW_PHONE_COUNT : SNOW_POOL_SIZE;
    for (let i = 0; i < flakes.length; i++) {
      const s = flakes[i]; s.visible = i < count; if (!s.visible) continue;
      snowPose(i, time, width, height, pose); s.position.set(pose.x, pose.y); s.scale.set(pose.size); s.rotation = pose.rotation;
    }
  }, destroy() {root.destroy({children: true}); for (const template of templates) template.destroy(true);}};
}
