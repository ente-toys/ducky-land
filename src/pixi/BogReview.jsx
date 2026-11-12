import {lazy,Suspense,useEffect,useRef,useState} from 'react';
const BogDemo=import.meta.env.DEV?lazy(()=>import('./bog-combat/BogDemo.jsx')):null;
import {PixiIsland} from './engine.js';
import {createSimulation} from './simulation.js';
import {installBogEnvironment,BOG_AREAS} from './bog-environment.js';
import {BOG_BLOCKERS} from './bog-blockers.js';
import {combatForBogEnvironment} from './bog-combat/environment.js';
import BogEntry from './bog-combat/BogEntry.jsx';
import {setBogReviewCamera,waitForBogArt,paintBogFrame} from './bog-review-camera.js';

export default function BogReview(){
 const host=useRef(null);
 const [ready,setReady]=useState(null),[visit,setVisit]=useState(0),[error,setError]=useState('');
 const rawBots=new URLSearchParams(location.search).get('bots');
 const bots=import.meta.env.DEV&&/^\d+$/.test(rawBots??'')?Math.min(20,Math.max(0,Number(rawBots))):0;
 const inspect=new URLSearchParams(location.search).has('inspect');
 useEffect(()=>{
  let cancelled=false,installation;
  const game=new PixiIsland({onError:e=>{globalThis.bogReviewError=String(e);if(!cancelled)setError(String(e));}});
  globalThis.bogGame=game;
  const camera=(x,y,zoom=.65)=>{
   setBogReviewCamera(game,x,y,zoom);
  };
  globalThis.bogCamera=camera;
  (async()=>{
   await game.mount(host.current);if(cancelled)return;
   installation=installBogEnvironment();
   game.switchIsland(installation.islandId);
   const dock=installation.map.HARBOR.land;
   camera(dock.x,dock.y-90,.65);
   game.canvas.dataset.state='loading';
   const sim=createSimulation(installation.map.walk,8612,{npcCount:0});
   const duck=sim.player;
   Object.assign(duck,{x:dock.x,y:dock.y,previousX:dock.x,previousY:dock.y,outfit:{}});
   game.rigs.slice(1).forEach(r=>r.dispose());game.rigs=game.rigs.slice(0,1);
   game.sim=sim;game.localDucks=sim.ducks;
   const {createDuck}=await import('./duck.js');
   const rig=await createDuck({outfit:{},seed:21,isPlayer:true});
   if(cancelled){rig.dispose();return;}
   rig.root.scale.set(.88*.24*3);
   game.rigs[0].dispose();game.rigs[0]=rig;game.objects.addChild(rig.root);
   camera(dock.x,dock.y-90,.65);
   if(!await waitForBogArt(game,{cancelled:()=>cancelled}))return;
   const area=new URLSearchParams(location.search).get('area');
   const focus=inspect&&BOG_AREAS[area]?BOG_AREAS[area]:null;
   paintBogFrame(game,focus?.x??dock.x,focus?(area==='mid'?2050:focus.y):dock.y-90,.65);
   if(cancelled||game.disposed)return;
   game.canvas.dataset.state='ready';
   globalThis.bogReviewReady=true;
   setReady({game,combat:combatForBogEnvironment(installation,BOG_BLOCKERS,BOG_AREAS)});
   game.canvas.focus();
  })().catch(e=>{if(!cancelled){console.error(e);globalThis.bogReviewError=String(e);setError(String(e));}});
  return()=>{cancelled=true;game.dispose();installation?.restore();if(globalThis.bogGame===game){globalThis.bogReviewReady=false;delete globalThis.bogGame;delete globalThis.bogCamera;}};
 },[]);
 const returnToDock=()=>{
  const g=ready?.game;if(!g||g.disposed)return;
  g.bogCombat?.leave(false);g.stopInput();
  const p=g.sim.player,dock=g.mapHere().HARBOR.land;
  Object.assign(p,{x:dock.x,y:dock.y,previousX:dock.x,previousY:dock.y,path:[],heading:null,pace:0,travel:0});
  globalThis.bogCamera(dock.x,dock.y-90,.65);g.canvas.focus();
 };
 return <main style={{position:'fixed',inset:0,background:'#6ec9de'}}>
  <div ref={host} style={{width:'100%',height:'100%'}}/>
  <nav aria-label="Bog environment review" style={{position:'absolute',left:12,top:12,display:'flex',gap:5,flexWrap:'wrap',maxWidth:900,font:'12px system-ui'}}>
   <button onClick={()=>globalThis.bogCamera?.(4200,4170,.1)}>Whole island</button>
   {Object.entries(BOG_AREAS).map(([name,a])=><button key={name} onClick={()=>globalThis.bogCamera?.(a.x,name==='mid'?2050:a.y,.65)}>{name}</button>)}
   <button onClick={()=>{const g=globalThis.bogGame;if(g){g.follow=true;g.camera.zoom=g.target.zoom=.8;g.canvas.focus();}}}>Follow Ducky</button>
   <button onClick={()=>{returnToDock();setVisit(n=>n+1);}}>Bog dock</button>
  </nav>
  {ready&&bots>0&&<Suspense fallback={null}><BogDemo engine={ready.game} combat={ready.combat} count={bots}/></Suspense>}
  {ready&&!inspect&&!bots&&<BogEntry key={visit} engine={ready.game} travel={{islandId:ready.combat.islandId,mode:'walking'}} status="playing" {...ready.combat} leaveLabel="Back to island" returnLabel="Back to dock" onReturnToDock={returnToDock} onLeave={returnToDock}/>}
  {error&&<p role="alert" style={{position:'absolute',top:60,left:16,background:'#fff8e7',padding:20}}>The Bog could not load: {error}</p>}
 </main>;
}
