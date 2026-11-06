// Corrections to authored map snapshots. Keep these with the client/server code
// so already-generated theme indexes get the same fix without regeneration.
// Cathedral's olive-14 was moved beyond the coast during the polish pass.
export const TREE_RELOCATIONS = {cathedral: {'olive-14': {from: [6670, 4030], to: [6400, 3870]}}};
export function fixThemeWorld(id, world) {
  const moves = TREE_RELOCATIONS[id];
  if (!moves) return world;
  return {...world,
    props: world.props?.map(p => moves[p.id] ? {...p, x: moves[p.id].to[0], y: moves[p.id].to[1]} : p),
    obstacles: world.obstacles.map(o => {
      const move = Object.values(moves).find(m => o.x === m.from[0] && o.y === m.from[1] - 9);
      return move ? {...o, x: move.to[0], y: move.to[1] - 9} : o;
    })};
}
export function fixThemeBed(id, bed) {
  const move = TREE_RELOCATIONS[id]?.[bed.tree];
  return move ? {...bed, x: move.to[0], y: move.to[1] + 14} : bed;
}
