// Read-only evidence for the shared-code stop condition in BIGGER-THEME.md.
import {readFileSync} from 'node:fs';
import {checkTheme} from '../theme-index.mjs';

const world = JSON.parse(readFileSync('rive/web/themes/library/world.json'));
const art = JSON.parse(readFileSync('public/pixi-art/themes/library/art.json'));
const validator = readFileSync('scripts/theme-index.mjs', 'utf8');
const limits = validator.match(/const MAX = \{width: (\d+), height: (\d+)\}/);
if (!limits) throw new Error('Validator limits changed. Review the prerequisites again.');
const maxWidth = Number(limits[1]), maxHeight = Number(limits[2]);
const polygonArea = ring => Math.abs(ring.reduce((sum, a, i) => {
  const b = ring[(i + 1) % ring.length];
  return sum + a[0] * b[1] - b[0] * a[1];
}, 0) / 2);
const landArea = world.coastRings.reduce((sum, ring) => sum + polygonArea(ring), 0);
const texturePixels = art.ground.tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0);
const checked = checkTheme('library');
console.log(JSON.stringify({
  status: landArea * 3 > maxWidth * maxHeight ? 'BLOCKED_SHARED_VALIDATOR' : 'REVIEW',
  currentBounds: {width: world.width, height: world.height},
  landArea, requestedLandArea: landArea * 3,
  validatorLimits: {width: maxWidth, height: maxHeight, area: maxWidth * maxHeight},
  theoreticalMaximumLandMultiplier: maxWidth * maxHeight / landArea,
  negativeOriginMarginCheckSupported: !validator.includes('x < 300 || y < 300'),
  currentReady: checked.ready, currentProblems: checked.problems,
  preservedCounts: {props: art.props.length, flats: art.flats.length, sleepers: checked.sleepers?.length},
  groundTextures: {tiles: art.ground.tiles.length, maxDimension: Math.max(...art.ground.tiles.flatMap(t => [t.width, t.height])),
    pixels: texturePixels, rgbaMB: texturePixels * 4 / 1e6, rgbaMiB: texturePixels * 4 / 1048576},
}, null, 2));
