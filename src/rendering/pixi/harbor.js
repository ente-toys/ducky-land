import {Container, Graphics, Text} from 'pixi.js';
import {PALETTE} from '../shared/palette.js';
import {islandFor} from '../../gameplay/islands.js';
import {mapOf} from '../../world/island-maps.js';

const {ink, wood, darkWood, cream, sandShade} = PALETTE;

export function createHarbor(decks, objects) {
  let current = mapOf('home'), shore = current.HARBOR.land;
  const flowers = new Graphics({label: 'Harbor flowers'});
  decks.addChild(flowers);
  const sign = new Container({label: 'Harbor signpost'}), board = new Graphics(), name = new Text({text: '', style: {
    fontFamily: 'system-ui, sans-serif', fontSize: 23, fontWeight: '800', fill: ink, letterSpacing: .3}});
  name.anchor.set(.5); name.position.set(0, -104); name.resolution = 3;
  sign.addChild(board, name);
  const inland = (side, distance) => {
    const water = current.HARBOR.water, length = Math.hypot(shore.x - water.x, shore.y - water.y);
    const dx = (shore.x - water.x) / length, dy = (shore.y - water.y) / length;
    return [shore.x + dx * distance - dy * side, shore.y + dy * distance + dx * side];
  };
  const placeSign = () => {sign.position.set(...inland(100, 70)); sign.zIndex = sign.y;};
  placeSign();
  objects.addChild(sign);
  const flag = new Container({label: 'Harbor flag'}), pole = new Graphics(), cloth = new Graphics();
  flag.addChild(pole, cloth);
  const placeFlag = () => {flag.position.set(...inland(-104, 70)); flag.zIndex = flag.y;};
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
      for (const node of [flowers, sign, flag]) node.destroy({children: true});
    },
    transient: () => [sign, flag, flowers],
    switchIsland(id) {
      const island = islandFor(id);
      current = mapOf(id); shore = current.HARBOR.land; placeSign(); placeFlag();
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
        const [cx, cy] = inland(fx, fy);
        for (let i = 0; i < 5; i++) flowers.circle(cx + Math.cos(i * Math.PI * .4) * 9, cy + Math.sin(i * Math.PI * .4) * 9, 7.5).fill(island.accent).stroke({color: ink, width: 1.4});
        flowers.circle(cx, cy, 4.5).fill(cream);
      }
      drawCloth(0, true);
    },
    update(t, reduced) {
      if (!reduced) drawCloth(t, false);
    },
  };
}
