import {PixiIsland} from '../../src/pixi/engine.js';
import {THEME_OF} from '../../src/pixi/island-maps.js';
window.game=new PixiIsland({onError:e=>{window.reviewError=String(e||'engine error');}});
await game.mount(document.getElementById('game'));
game.switchIsland([...THEME_OF].find(([,t])=>t==='cathedral')[0]);
window.reviewCamera=(x,y,zoom)=>{game.follow=false;game.fitMode=false;game.fly=null;Object.assign(game.camera,{x,y,zoom});Object.assign(game.target,game.camera);};
window.reviewReady=true;
