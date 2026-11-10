import base from '../../vite.config.js';
import {bogCombatPlugin} from '../../src/pixi/bog-combat/vite-plugin.mjs';
import {BOG_COMBAT} from '../../src/pixi/bog-combat/config.js';
export default {...base,cacheDir:'./.bog-vite-cache',
 plugins:[...base.plugins,bogCombatPlugin({combat:BOG_COMBAT})],
 build:{...base.build,rollupOptions:{input:{main:'index.html',bog:'scripts/bog-environment/review.html',home:'scripts/bigger-home/review.html'}}},
};
