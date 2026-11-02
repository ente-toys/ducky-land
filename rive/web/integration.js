import {installUI} from './ui.js';
import {installControls} from './controls.js';
import {installCrowd} from './crowd.js';
import {installLife} from './life.js';
import {installActivities} from './activities.js';
import {installNetwork} from './network.js';
import {installAssets} from './assets.js';

async function start(){
  const game=window.game;
  game.inputLocked=true;
  await installAssets(game);
  installControls(game);
  installCrowd(game);
  installLife(game);
  installActivities(game);
  installNetwork(game);
  await installUI(game);
  game.integrationReady=true;
}
if(window.game?.ready)start().catch(console.error);
else addEventListener('ducky-ready',()=>start().catch(console.error),{once:true});
