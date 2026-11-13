import {Container, Graphics, Text} from 'pixi.js';
import {PALETTE} from '../shared/palette.js';
import {islandFor, near} from '../../gameplay/islands.js';
import {mapFor, mapOf} from '../../world/island-maps.js';

const {ink, wood, darkWood, cream, sandShade} = PALETTE;

export function drawJetty(container, {x, y, length, angle = 0, width = 104, scale = 1, wetFrom = .3, railTo = .42, moorings = [], art = null}) {
  const s = scale, d = {x: Math.sin(angle), y: -Math.cos(angle)}, n = {x: -d.y, y: d.x}, hw = width / 2;
  const at = (t, side = 0) => ({x: x + d.x * t + n.x * side, y: y + d.y * t + n.y * side});
  const root = new Container({label: 'Jetty'}), g = new Graphics();
  root.addChild(g);
  const corners = [at(0, -hw), at(length, -hw), at(length, hw), at(0, hw)], flat = pts => pts.flatMap(p => [p.x, p.y]);
  const wet0 = length * wetFrom, outline = {color: ink, width: 2.22 * s};
  if (!art) {
  g.poly(flat([at(wet0, -hw), at(length, -hw), at(length, hw), at(wet0, hw)].map(p => ({x: p.x + 7 * s, y: p.y + 16 * s})))).fill({color: ink, alpha: .14});
  const pile = p => {
    g.ellipse(p.x, p.y + 34 * s, 12 * s, 4.6 * s).fill({color: ink, alpha: .12});
    g.rect(p.x - 4.5 * s, p.y - 6 * s, 9 * s, 40 * s).fill(darkWood).stroke(outline);
    g.ellipse(p.x, p.y + 34 * s, 11 * s, 4.2 * s).stroke({color: cream, width: 1.6 * s, alpha: .9});
  };
  const piles = Math.max(1, Math.round((length - wet0) / (72 * s)));
  for (let i = 0; i <= piles; i++) for (const side of [-hw + 6 * s, hw - 6 * s]) pile(at(wet0 + (length - wet0 - 8 * s) * i / piles, side));
  const T = 11 * s, face = (a, b) => g.poly(flat([a, b, {x: b.x, y: b.y + T}, {x: a.x, y: a.y + T}])).fill(darkWood).stroke(outline);
  if (-n.y > .05) face(corners[0], corners[1]);
  if (n.y > .05) face(corners[3], corners[2]);
  if (d.y > .05) face(corners[1], corners[2]);
  g.poly(flat(corners)).fill(wood).stroke(outline);
  for (const side of [-hw + 7 * s, hw - 7 * s]) {const a = at(4 * s, side), b = at(length - 4 * s, side); g.moveTo(a.x, a.y).lineTo(b.x, b.y);}
  g.stroke({color: darkWood, width: 1.6 * s, alpha: .8});
  for (let t = 20 * s, i = 0; t < length - 6 * s; t += 22 * s, i++) {
    const a = at(t, -hw + 2 * s), b = at(t, hw - 2 * s);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({color: ink, width: 1.11 * s});
    if (i % 3 === 1) {const c = at(t + 11 * s, (i % 2 ? -1 : 1) * hw * .3), e = at(t + 11 * s, (i % 2 ? -1 : 1) * hw * .3 + 18 * s); g.moveTo(c.x, c.y).lineTo(e.x, e.y).stroke({color: i % 6 === 1 ? darkWood : ink, width: 1.11 * s});}
  }
  const railEnd = length * railTo, posts = Math.max(1, Math.round(railEnd / (66 * s))), H = 30 * s;
  for (const side of [-hw + 3 * s, hw - 3 * s]) {
    const tops = [];
    for (let i = 0; i <= posts; i++) {
      const p = at(8 * s + (railEnd - 8 * s) * i / posts, side);
      g.rect(p.x - 4.5 * s, p.y - H, 9 * s, H).fill(wood).stroke(outline);
      tops.push({x: p.x, y: p.y - H + 3 * s});
    }
    g.poly(flat(tops), false).stroke({color: ink, width: 8.5 * s, cap: 'round', join: 'round'});
    g.poly(flat(tops), false).stroke({color: wood, width: 4.4 * s, cap: 'round', join: 'round'});
    for (const p of tops) g.roundRect(p.x - 6.5 * s, p.y - 5.5 * s, 13 * s, 5 * s, 1.7 * s).fill(darkWood).stroke(outline);
  }
  }
  const ties = moorings.map(m => {
    if (!m) return null;
    const along = (m.x - x) * d.x + (m.y - y) * d.y, lateral = (m.x - x) * n.x + (m.y - y) * n.y;
    if (Math.abs(lateral) > hw + 260 * s) return null;
    const tip = along > length - 30 * s, side = Math.sign(lateral || 1) * (hw - 10 * s);
    const p = at(tip ? length - 10 * s : Math.max(wet0 + 10 * s, Math.min(length - 30 * s, along)), side);
    g.ellipse(p.x, p.y + 1 * s, 9 * s, 3.5 * s).fill({color: ink, alpha: .2});
    g.roundRect(p.x - 6 * s, p.y - 15 * s, 12 * s, 16 * s, 3 * s).fill(darkWood).stroke(outline);
    g.ellipse(p.x, p.y - 15 * s, 7.5 * s, 3.2 * s).fill(wood).stroke(outline);
    return {x: p.x, y: p.y - 10 * s};
  });
  container.addChild(root);
  return {root, ties, foot: at(0), tip: at(length)};
}

export function createHarbor(decks, objects) {
  const jetties = new Map();
  const jettyFor = mapId => {
    if (!jetties.has(mapId)) {
      const {JETTY, HARBOR} = mapFor(mapId);
      const alongside = m => {const t = (m.x - JETTY.foot.x) * JETTY.dir.x + (m.y - JETTY.foot.y) * JETTY.dir.y, p = JETTY.along(Math.max(0, Math.min(JETTY.length, t)));
        return t > 0 && t < JETTY.length + 60 && Math.hypot(m.x - p.x, m.y - p.y) < 260;};
      const built = drawJetty(decks, {x: JETTY.foot.x, y: JETTY.foot.y, length: JETTY.length, angle: JETTY.angle, width: JETTY.width,
        wetFrom: JETTY.wetFrom, art: JETTY.art, moorings: HARBOR.moorings.map(m => alongside(m) ? m : null)});
      built.root.label = `Jetty ${mapId}`; built.root.visible = false;
      jetties.set(mapId, built);
    }
    return jetties.get(mapId);
  };
  let current = mapFor('home'), jetty = jettyFor('home');
  jetty.root.visible = true;
  const JETTY = () => current.JETTY;
  const ropes = new Graphics({label: 'Mooring ropes'});
  decks.addChild(ropes);
  const flowers = new Graphics({label: 'Harbor flowers'});
  decks.addChild(flowers);
  const sign = new Container({label: 'Harbor signpost'}), board = new Graphics(), name = new Text({text: '', style: {
    fontFamily: 'system-ui, sans-serif', fontSize: 23, fontWeight: '800', fill: ink, letterSpacing: .3}});
  name.anchor.set(.5); name.position.set(0, -104); name.resolution = 3;
  sign.addChild(board, name);
  const placeSign = () => {sign.position.set(JETTY().foot.x + 100, JETTY().foot.y + 44); sign.zIndex = sign.y;};
  placeSign();
  objects.addChild(sign);
  const flag = new Container({label: 'Harbor flag'}), pole = new Graphics(), cloth = new Graphics();
  flag.addChild(pole, cloth);
  const placeFlag = () => {flag.position.set(JETTY().foot.x - 104, JETTY().foot.y + 46); flag.zIndex = flag.y;};
  placeFlag();
  pole.ellipse(0, 0, 22, 7).fill({color: ink, alpha: .16})
    .roundRect(-13, -12, 26, 14, 4).fill(darkWood).stroke({color: ink, width: 2.6})
    .rect(-4.5, -178, 9, 168).fill(wood).stroke({color: ink, width: 2.6})
    .circle(0, -182, 7).fill(sandShade).stroke({color: ink, width: 2.6});
  objects.addChild(flag);
  let accent = 0xffda69;
  const drawCloth = (t, reduced) => {
    cloth.clear();
    const top = -172, len = 92, hgt = 50, pts = [];
    for (let i = 0; i <= 8; i++) {const u = i / 8, wave = reduced ? Math.sin(u * 2.4) * 3 * u : Math.sin(t * 3.2 - u * 4.2) * 6 * u; pts.push([6 + u * len, top + wave + u * hgt * .5]);}
    for (let i = 8; i >= 0; i--) {const u = i / 8, wave = reduced ? Math.sin(u * 2.4) * 3 * u : Math.sin(t * 3.2 - u * 4.2) * 6 * u; pts.push([6 + u * len * (1 - .0), top + hgt - u * hgt * .5 + wave]);}
    cloth.poly(pts.flat()).fill(accent).stroke({color: ink, width: 2.6, join: 'round'});
    cloth.moveTo(14, top + 12).lineTo(14 + len * .55, top + 12 + hgt * .28 + (reduced ? 0 : Math.sin(t * 3.2 - 2) * 3)).stroke({color: cream, width: 2, alpha: .55, cap: 'round'});
  };
  return {
    dispose() {
      for (const {root} of jetties.values()) root.destroy({children: true});
      jetties.clear();
      for (const node of [ropes, flowers, sign, flag]) node.destroy({children: true});
    },
    transient: () => [sign, flag, flowers],
    show(mapId) {jettyFor(mapId); for (const [id, j] of jetties) j.root.visible = id === mapId;},
    switchIsland(id) {
      const island = islandFor(id);
      current = mapOf(id); jetty = jettyFor(current.id); this.show(current.id); placeSign(); placeFlag();
      accent = island.accent;
      name.text = island.name;
      const w = Math.max(150, name.width + 40), top = -128, h = 46;
      board.clear()
        .ellipse(0, 0, 26, 8).fill({color: ink, alpha: .16})
        .rect(-5, -136, 10, 136).fill(darkWood).stroke({color: ink, width: 2.6})
        .roundRect(-w / 2, top, w, h, 7).fill(wood).stroke({color: ink, width: 3})
        .moveTo(-w / 2 + 8, top + h / 2).lineTo(w / 2 - 8, top + h / 2).stroke({color: darkWood, width: 1.4, alpha: .55})
        .circle(-w / 2 + 11, top + 10, 2.4).fill(ink).circle(w / 2 - 11, top + 10, 2.4).fill(ink)
        .poly([70, -70, -18, -70, -18, -78, -44, -60, -18, -42, -18, -50, 70, -50]).fill(sandShade).stroke({color: ink, width: 2.6, join: 'round'});
      flowers.clear();
      if (id !== 'home') for (const [fx, fy] of [[-150, 70], [-118, 92], [150, 100], [184, 80], [60, 120]]) {
        const cx = JETTY().foot.x + fx, cy = JETTY().foot.y + fy;
        for (let i = 0; i < 5; i++) flowers.circle(cx + Math.cos(i * Math.PI * .4) * 9, cy + Math.sin(i * Math.PI * .4) * 9, 7.5).fill(island.accent).stroke({color: ink, width: 1.4});
        flowers.circle(cx, cy, 4.5).fill(cream);
      }
      drawCloth(0, true);
    },
    update(boats, t, reduced) {
      if (!reduced) drawCloth(t, false);
      ropes.clear();
      for (const boat of boats) {
        if (boat.occupant) continue;
        const i = current.HARBOR.moorings.findIndex(m => near(boat, m, 30));
        if (i < 0 || !jetty.ties[i]) continue;
        const tie = jetty.ties[i], bob = reduced ? 0 : Math.sin(t * 1.4) * 2, side = Math.sign(tie.x - boat.x) || 1;
        const end = {x: boat.x + side * 62, y: boat.y - 26 + bob}, mid = {x: (tie.x + end.x) / 2, y: (tie.y + end.y) / 2 + 16 + (reduced ? 0 : Math.sin(t * 1.1 + i) * 2)};
        for (const [color, width] of [[ink, 4.6], [sandShade, 2.2]]) ropes.moveTo(tie.x, tie.y).quadraticCurveTo(mid.x, mid.y, end.x, end.y).stroke({color, width, cap: 'round'});
        ropes.circle(tie.x, tie.y, 3.2).fill(sandShade).stroke({color: ink, width: 1.4});
      }
    },
  };
}
