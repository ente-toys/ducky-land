// Include this new theme in the checker in memory, without editing the shared registry.
import {THEME_IDS} from '../../src/pixi/island-maps.js';
if(!THEME_IDS.includes('peaks'))THEME_IDS.push('peaks');
