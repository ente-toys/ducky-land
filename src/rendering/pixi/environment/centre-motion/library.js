import {createFountainWater} from '../fountain.js';

export function libraryFountainLayout(props) {
  const globe = props.find(p => p.centrePiece?.id === 'globe');
  if (!globe) return null;
  const piece = globe.centrePiece, scale = globe.width * globe.scale / piece.width;
  const origin = {x: globe.x - (piece.x + piece.width / 2) * scale,
    y: globe.y - piece.sortY * scale};
  const jets = props.filter(p => p.centrePiece?.animate?.kind === 'jet').map(prop => {
    const p = prop.centrePiece, front = p.id.includes('front'), sortY = p.sortY;
    return {prop, sortY, spill: {start: p.at[0], x: p.landing[0], bottom: p.landing[1] - sortY, w: 18.8,
      jet: {y: p.at[1] - sortY, cx: Math.sign(p.at[0]) * 168.1,
        cy: (front ? -127.8 : -404.2) - sortY}}};
  });
  return {origin, scale, jets};
}

export function createLibraryFountain(art, objects) {
  const layout = libraryFountainLayout(art.props);
  if (!layout) return null;
  const {origin, scale, jets} = layout, roots = [];
  const common = {centre: {x: 0, y: 0}, spray: null, cleanArtwork: false};
  const pool = createFountainWater({...origin, scale}, art.ground, null, {...common,
    pool: {x: 0, y: -20, rx: 485, ry: 365}, minPoolY: -Infinity, spills: []});
  roots.push(pool.root);
  const flows = jets.map(({prop, sortY, spill}, i) => {
    const flow = createFountainWater({x: origin.x, y: origin.y + sortY * scale, scale}, objects, null,
      {...common, pool: null, spills: [spill], minDropY: -Infinity, sprayRate: 8, phase: i * .41});
    flow.root.label = `Pagepond fountain - ${prop.centrePiece.id}`;
    flow.root.zIndex = prop.sprite.zIndex + .000001;
    flow.root.themeArt = art.id;
    roots.push(flow.root);
    const alpha = prop.sprite.alpha;
    return {...flow, prop, alpha};
  });
  let destroyed = false;
  return {roots, update(t, reduced, visible) {
    if (destroyed) return;
    pool.update(t, reduced, visible);
    for (const flow of flows) {
      flow.prop.sprite.alpha = reduced ? flow.alpha : 0;
      flow.update(t, reduced, visible && flow.prop.sprite.visible);
    }
  }, destroy() {
    if (destroyed) return;
    destroyed = true;
    for (const {prop, alpha} of flows) if (!prop.sprite.destroyed) prop.sprite.alpha = alpha;
    for (const root of roots) if (!root.destroyed) root.destroy({children: true});
  }};
}
