import moves from './home-bushes.json' with {type: 'json'};
const isHomeBush = p => /(?:^|[\s/_-])(?:bush|shrub)(?:$|[\s/_.-]|[0-9])/i.test([p.asset, p.name, p.src].join(' '));
export function fitHomeBush(p) {
  if (!isHomeBush(p)) return p;
  const move = moves[p.id], q = move ? {...p, ...move, ...(p.z === undefined ? {} : {z: p.z + move.y - p.y})} : {...p};
  const width = q.width * q.scale, height = q.height * q.scale;
  q.footprint = {x: q.x, y: q.y - height * .1, rx: width * .44, ry: height * .16};
  return q;
}
