import {PixiIsland} from '/src/pixi/engine.js';
import {registerMap,THEME_OF} from '/src/pixi/island-maps.js';
import {worldIsland} from '/src/pixi/world-map.js';
const load=p=>fetch(p).then(r=>r.json());
const theme=new URLSearchParams(location.search).get('theme')||'lantern';
if(theme==='lantern'){
 const [world,walk,harbor]=await Promise.all(['world','walk-world','harbor'].map(n=>load('/rive/web/themes/lantern/'+n+'.json')));
 const sleepers=await load('/rive/web/themes/lantern/sleepers-resolved.json');
 registerMap('lantern',{world,walk,harbor,sleepers,art:'/pixi-art/themes/lantern/art.json',sea:'#7FD3D6'});
 // Runtime-only preview binding, never writes the shared registry.
 THEME_OF.set('isle-170','lantern');
 Object.assign(worldIsland('isle-170'),{theme:'lantern',name:'Lantern Lake',width:8000,height:6000});
}
const game=new PixiIsland({onError:e=>{window.reviewError=String(e);console.error(e)}});window.reviewGame=game;
await game.mount(document.querySelector('#game'));
if(theme==='lantern')game.switchIsland('isle-170');
window.reviewCamera=(x,y,zoom)=>{game.fly=null;game.follow=false;game.fitMode=false;Object.assign(game.camera,{x,y,zoom});Object.assign(game.target,game.camera)};
window.reviewCamera(...(theme==='lantern'?[4000,3000,.20]:[2900,2200,.30]));
if(theme==='lantern'){
 const until=performance.now()+120000;
 while(!game.artReady('lantern')){if(performance.now()>until)throw Error('Lantern art load timed out');await new Promise(r=>setTimeout(r,50));}

}
window.reviewReady=true;
