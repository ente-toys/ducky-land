// Public island ids, rather than theme names, control the rule.
export const hasPropOutlines = id => id === 'home' || id === 'sunset' || id === 'isle-251' || id === 'isle-249' || id === 'isle-250' || id === 'isle-55';
export const propObstacles = props => props.flatMap(p=>[p.footprint,p.bodyFootprint].filter(Boolean));

// On Home, a house blocks only at its base, so Duckies can pass between houses and walk behind roofs.
const HOUSE = /house|cottage|bakery|cafe|shop|lodge|studio|hall|greenhouse/i, NOT_HOUSE = /lighthouse|shadow|lamp|sign/i;
// Neighbourhood names also occur on furniture and small bird shelters.
// Keep the shipped Home rule, but do not apply its broad name match to these
// non-house props when extending the rule to the other islands.
const ISLAND_NON_HOUSE = /birdhouse|bench|bookshelf|chair|table|rack|stool|hanging-lantern|paper-rolls|woodpile|mailbox|lectern|books-hall|candy-cart|pink-arc-cafe|pool|stage/i;
const isHouse = o => { const n = `${o.prop ?? ''} ${o.name ?? ''} ${o.id ?? ''}`; return HOUSE.test(n) && !NOT_HOUSE.test(n); };
function houseBase(f) {
  const rings = [f.poly, ...(f.parts ?? [])], ys = rings.flat().map(q => q[1]), bottom = Math.max(...ys);
  const cut = bottom - Math.min(140, Math.max(36, (bottom - Math.min(...ys)) * .3));
  const clip = ring => ring.flatMap((a, i) => { const b = ring[(i + 1) % ring.length], out = a[1] >= cut ? [a] : [];
    if ((a[1] >= cut) !== (b[1] >= cut)) out.push([a[0] + (b[0] - a[0]) * (cut - a[1]) / (b[1] - a[1]), cut]); return out; });
  const base = rings.map(clip).filter(r => r.length >= 3);
  const {parts, ...rest} = f;
  return base.length ? {...rest, homeHouseBase: true, poly: base[0], ...(base.length > 1 ? {parts: base.slice(1)} : {})} : f;
}
export const usesHouseBase = (o, island = false) => isHouse(o) && (!island || !ISLAND_NON_HOUSE.test(`${o.prop ?? ''} ${o.name ?? ''} ${o.id ?? ''}`));
export const homeHouseBases = (obstacles, island = false) => {
  const house = o => usesHouseBase(o, island);
  return obstacles.filter(o => !(o.bodyBlock && house(o))).map(o => o.poly && !o.homeHouseBase && house(o) ? houseBase(o) : o);
};
