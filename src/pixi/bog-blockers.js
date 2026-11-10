import blockers from './bog-blockers.json' with {type:'json'};

// Island-local world units, x right, y down. Rect x/y is its TOP LEFT.
// Buildings/walls are authoritative solid footprints, not sprite bounds.
// Arcade bays block only at their two drawn pier feet, leaving the opening clear.
// Trees block only at the trunk; their canopy stays fully opaque.
export const BOG_BLOCKERS = Object.freeze(blockers.map(b=>Object.freeze(b)));
export const BOG_SOLIDS = Object.freeze(BOG_BLOCKERS.filter(b=>b.kind!=='tree'));
export const bogBlockerPolygons = (includeTrees=true) => (includeTrees?BOG_BLOCKERS:BOG_SOLIDS).map(b=>({
 id:b.id,kind:b.kind,poly:[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]],
}));
