import {render,read} from './render.mjs';
await render(read('scripts/bigger-pink/drawing-art.json'),[-2600,-1900,13200,9800],.15,'../concepts/themes/world-map/bigger/pink-bigger.png',{labels:read('scripts/bigger-pink/layout.json').places});
