// Test preload: use current Goldmine files before the integration owner regenerates
// the shared themes/index.js. Does not edit the registry or any other theme.
import {readFileSync} from 'node:fs';
import {registerMap} from '../../src/pixi/island-maps.js';
import {checkTheme} from '../theme-index.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url)));
const report=checkTheme('goldmine');
if(!report.ready)throw Error('Goldmine is not ready: '+report.problems.join('; '));
registerMap('goldmine',{
 world:read('assets/world/themes/goldmine/world.json'),
 walk:read('assets/world/themes/goldmine/walk-world.json'),
 harbor:read('assets/world/themes/goldmine/harbor.json'),
 art:'/pixi-art/themes/goldmine/art.json',sea:report.sea,sleepers:report.sleepers,
});
