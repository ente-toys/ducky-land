// Home only. Classify by authored art identity and rendered size, never placement id.
export function propOutlineKind(prop) {
  const name = `${prop.src.split('/').at(-1)} ${prop.asset ?? ''} ${prop.name ?? ''}`.toLowerCase();
  const w = prop.width * (prop.scale ?? 1), h = prop.height * (prop.scale ?? 1);
  if (/bush|shrub|hedge/.test(name)) return 'solid';
  if (/shadow|oven-smoke|bunting|banner/.test(name)) return 'decoration';
  if (/bridge|jetty|boardwalk/.test(name)) return 'walkway';
  if (/towel|blanket|rug|puddle|petals?(?:[ ._-]|$)|sand-speck|path-stone/.test(name)) return 'decal';
  if (!/pot|planter|bed|island|rack/.test(name) && /flower|tulip|grass|pebble|shell|rope-coil|rock-flat|mushroom/.test(name) && w <= 145 && h <= 110) return 'decal';
  // Trees, lamps and reeds block their entire drawing, including canopies.
  return 'solid';
}
