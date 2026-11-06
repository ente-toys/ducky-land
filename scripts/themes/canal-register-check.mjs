// QA only: add this candidate to the checker process without touching the shared registry.
// node --import ./scripts/themes/canal-register-check.mjs scripts/theme-index.mjs --check
import {THEME_IDS} from '../../src/pixi/island-maps.js';
if (!THEME_IDS.includes('canal')) THEME_IDS.push('canal');
