import {PixiIsland} from '/src/pixi/engine.js';
import {THEME_OF,registerMap} from '/src/pixi/island-maps.js';
const load=p=>fetch(p).then(r=>r.json());
const [world,walk,harbor,sleepers,plan]=await Promise.all([
 ...['world','walk-world','harbor'].map(n=>load('/assets/world/themes/neon/'+n+'.json')),
 load('/pixi-art/themes/neon/resolved-sleepers.json'),load('/scripts/bigger-neon/plan.json')]);
registerMap('neon',{world,walk,harbor,sleepers,art:'/pixi-art/themes/neon/art.json',sea:'#6ec9de'});
const game=new PixiIsland({onError:e=>{window.reviewError=String(e);console.error(e)}});window.reviewGame=game;
await game.mount(document.querySelector('#game'));
game.switchIsland([...THEME_OF].find(([,t])=>t==='neon')[0]);
window.reviewCamera=(x,y,zoom)=>{game.fly=null;game.follow=false;game.fitMode=false;Object.assign(game.camera,{x,y,zoom});Object.assign(game.target,game.camera)};
const name=new URLSearchParams(location.search).get('place'),place=plan.places.find(p=>p.id===name);
window.reviewCamera(...(place?[place.x,place.y,.8]:[3900,2450,Math.min(innerWidth/12800,innerHeight/9800)]));
const until=performance.now()+90000;
while(!game.artReady('neon')){if(performance.now()>until)throw Error('Neon art load timed out');await new Promise(r=>setTimeout(r,50));}
window.reviewReady=true;
