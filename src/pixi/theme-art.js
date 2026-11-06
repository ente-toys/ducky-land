// boss 6 Nov: a themed island's own art (concepts/themes/THEME-CONTRACT.md, section 4), loaded only when that island or
// its copy comes near (engine.js ensureArt), so start-up stays as fast as before. Builds, in the island map's own local
// coordinates: the ground (tiles + flats), the decks Duckies walk over, the contact shadows, and the standing props (sorted
// with the Duckies by y). Everything starts hidden; the engine shows one island's art at a time (showArt).
import {Container, Graphics, Sprite} from 'pixi.js';

const WIND = /tree|reeds|cattails|flower|leaf|bush|flag|bunting|banner|umbrella|sunflower/i;
const NO_SHADOW = /bunting|banner|flag|bridge|blanket|lily|shell|reeds|rug|path|paving/i;

export async function loadThemeArt(map, {acquire, release}) {
  const [manifest, centre] = await Promise.all([
    fetch(map.art).then(response => {
      if (!response.ok) throw Error(`theme art ${map.id}: HTTP ${response.status}`);
      return response.json();
    }),
    fetch(map.art.replace('art.json', 'centre/centre.json'))
      .then(response => response.ok ? response.json() : {pieces: []}),
  ]);
  const base = map.art.slice(0, map.art.lastIndexOf('/') + 1);
  const url = src => /^(\/|https?:|data:)/.test(src) ? src : base + src;
  const tiles = manifest.ground?.tiles ?? [], decks = manifest.decks ?? [], flats = manifest.flats ?? [], props = manifest.props ?? [];
  const floating = manifest.floating ?? [];   // boss 6 Nov: lily pads and other floating things that bob on the water, like home's
  const entries = [...tiles.map(t => ({...t, resolution: t.resolution ?? 1})), ...decks.map(d => ({...d, resolution: d.resolution ?? 1.5})),
    ...flats.map(f => ({...f, resolution: f.resolution ?? 2})), ...props.map(p => ({...p, resolution: p.resolution ?? 2})),
    ...floating.map(f => ({...f, resolution: f.resolution ?? 2}))];
  const sources = entries.map(e => url(e.src));
  // Repeated flowers, tiles and props share one lease per theme, at the highest
  // requested resolution. Fair alone places over 1,900 sprites from 108 sources.
  const resolutions = new Map();
  entries.forEach((entry, i) => resolutions.set(sources[i], Math.max(resolutions.get(sources[i]) ?? 0, entry.resolution)));
  const uniqueSources = [...resolutions.keys()];
  const loaded = await Promise.allSettled(uniqueSources.map(src => acquire(src, resolutions.get(src))));
  const failed = loaded.find(result => result.status === 'rejected');
  if (failed) {
    uniqueSources.forEach(src => release(src));
    throw failed.reason;
  }
  const bySource = new Map(uniqueSources.map((src, i) => [src, loaded[i].value]));
  const textures = sources.map(src => bySource.get(src));
  let destroyed = false;
  const ground = new Container({label: `Theme ${map.id} - ground`}), deckLayer = new Container({label: `Theme ${map.id} - decks`});
  const shadows = new Container({label: `Theme ${map.id} - shadows`});
  let k = 0;
  for (const tile of tiles) {
    const s = new Sprite(textures[k++]); s.position.set(tile.x, tile.y); s.width = tile.width; s.height = tile.height; ground.addChild(s);
  }
  for (const deck of decks) {
    const s = new Sprite(textures[k++]); s.position.set(deck.x, deck.y); s.width = deck.width; s.height = deck.height; deckLayer.addChild(s);
  }
  for (const flat of flats) {
    const s = new Sprite(textures[k++]); s.position.set(flat.x, flat.y);
    if (!flat.topLeft) s.anchor.set(.5, 1);   // decals sit on their base point, like home's
    s.width = flat.width; s.height = flat.height; if (flat.flip) s.scale.x *= -1;
    ground.addChild(s);
  }
  const standing = props.map((prop, i) => {
    const scale = prop.scale ?? 1, anchor = prop.anchor ?? {x: .5, y: 1}, name = prop.name ?? prop.asset ?? prop.src;
    const sprite = new Sprite(textures[k++]);
    sprite.anchor.set(anchor.x, anchor.y); sprite.position.set(prop.x, prop.y);
    sprite.width = prop.width * scale; sprite.height = prop.height * scale;
    if (prop.flip) sprite.scale.x *= -1;
    if (prop.tint) sprite.tint = prop.tint;
    sprite.zIndex = prop.y; sprite.standing = true; sprite.visible = false; sprite.themeArt = map.id;
    let shadow = null;
    if (!NO_SHADOW.test(name) && prop.shadow !== false) {
      const rx = Math.max(8, Math.min(300, prop.width * scale * .36)), ry = rx * .3;
      shadow = new Graphics().ellipse(rx * .06, ry * .1, rx, ry).fill({color: 0x3c5a2a, alpha: .15});
      shadow.position.set(prop.x, prop.y); shadows.addChild(shadow);
    }
    const centrePiece = typeof prop.centrePiece === 'object' ? prop.centrePiece : centre.pieces.find(p => prop.id?.endsWith(p.id) && prop.src.includes('centre/'));
    return {...prop, centrePiece, id: prop.id ?? `${map.id}-${i}`, name, scale, sprite, shadow, deck: prop.deck ?? /bridge|deck/i.test(name), wind: prop.wind ?? (!prop.src.includes('centre/') && WIND.test(name))};
  });
  const floatLayer = new Container({label: `Theme ${map.id} - floating`});
  const floats = floating.map((item, i) => {
    const sprite = new Sprite(textures[k++]), anchor = item.anchor ?? {x: .5, y: .5};
    sprite.anchor.set(anchor.x, anchor.y); sprite.position.set(item.x, item.y); sprite.width = item.width; sprite.height = item.height;
    if (item.flip) sprite.scale.x *= -1;
    floatLayer.addChild(sprite);
    return {...item, phase: item.phase ?? i * 1.7, sprite};
  });
  for (const group of [ground, deckLayer, shadows, floatLayer]) group.visible = false;
  return {
    id: map.id, map, ready: true, sea: manifest.sea ?? map.sea ?? null, ground, decks: deckLayer, shadows, props: standing, floatLayer, floating: floats,
    groups: [ground, deckLayer, shadows, floatLayer],
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const c of [ground, deckLayer, shadows, floatLayer]) c.destroy({children: true});
      for (const p of standing) p.sprite.destroy();
      uniqueSources.forEach(src => release(src));
    },
  };
}
