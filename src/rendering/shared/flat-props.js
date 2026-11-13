// Flat ground art (loose flowers, grass, pebbles, shells, flat rocks, blankets,
// towels, rugs, cushions, benches, ripples) is always drawn under every Ducky.
// Upright art keeps sorting by its base line. Walking is not affected.
const FLAT = /(?:^|[-_ /])(?:flowers?|flower-(?:patch|clump)|daisy|meadow|grass|grass-tuft|pebbles?|shells?|scallop|conch|cowrie|rock-flat|lily|lily-pad|mushrooms?|field-row(?:-short)?|field-flower|centre-field|blanket|towel|rug|mat|cushions?|bench|ripple|glints)(?=$|[-_ .\d/])/i;
const UPRIGHT = /planter|pot|crate|bed|stall|cart|box|tall|arch|arc|banner|lamp|sign|workbench|table|basket|bush|tree|hedge|sunflower|house|home|cottage|pavilion|hall|shop|wz-|lib|washline|campfire|picnic-(?:west|east)/i;
export const FLAT_Z = -1e6;

export function isFlatProp(prop) {
  const name = String(prop.asset ?? prop.name ?? '') + ' ' + String(prop.src ?? '').split('/').pop().replace(/\.svg$/, '');
  return FLAT.test(name) && !UPRIGHT.test(name);
}

export const propZ = (prop, y) => (isFlatProp(prop) ? FLAT_Z + y : y);
