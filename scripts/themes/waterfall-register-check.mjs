// Validation-only preload: no registry file edits. The integrator owns THEME_IDS.
import {THEME_IDS} from '../../src/pixi/island-maps.js';
if (!THEME_IDS.includes('waterfall')) THEME_IDS.push('waterfall');
