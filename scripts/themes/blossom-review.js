import {PixiIsland} from '/src/pixi/engine.js';
import {registerMap,THEME_OF} from '/src/pixi/island-maps.js';
import {worldIsland} from '/src/pixi/world-map.js';
const load=p=>fetch(p).then(r=>r.json());
const theme=new URLSearchParams(location.search).get('theme')||'blossom';
if(theme==='blossom'){
 const [world,walk,harbor]=await Promise.all(['world','walk-world','harbor'].map(n=>load('/assets/world/themes/blossom/'+n+'.json')));
 const sleepers=await load('/assets/world/themes/blossom/sleepers-resolved.json');
 registerMap('blossom',{world,walk,harbor,sleepers,art:'/pixi-art/themes/blossom/art.json',sea:'#8CC8CD'});
 // Runtime-only preview binding, never writes the shared registry.
 THEME_OF.set('isle-170','blossom');
 Object.assign(worldIsland('isle-170'),{theme:'blossom',name:'Cherry Blossom Hill',width:7600,height:5400});
}
const game=new PixiIsland({onError:e=>{window.reviewError=String(e);console.error(e)}});window.reviewGame=game;
await game.mount(document.querySelector('#game'));
if(theme==='blossom')game.switchIsland('isle-170');
window.reviewCamera=(x,y,zoom)=>{game.fly=null;game.follow=false;game.fitMode=false;Object.assign(game.camera,{x,y,zoom});Object.assign(game.target,game.camera)};
window.reviewCamera(...(theme==='blossom'?[3800,2700,.22]:[2900,2200,.30]));
if(theme==='blossom'){
 const until=performance.now()+120000;
 while(!game.artReady('blossom')){if(performance.now()>until)throw Error('Blossom art load timed out');await new Promise(r=>setTimeout(r,50));}

}
window.reviewReady=true;
