import manifest from '../../../public/pixi-art/globe/manifest.json' with {type:'json'};

export function globePreviewUrl(island) {
  const art = manifest[island.theme ?? 'home'];
  return `${art.src}?v=${art.sha256.slice(0, 12)}`;
}
