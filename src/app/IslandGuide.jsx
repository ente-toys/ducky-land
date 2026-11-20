import {TELEPORT_COST} from '../gameplay/teleport.js';
import {useEffect, useRef, useState} from 'react';
import {RULES} from '../features/bog-combat/rules.js';
import {KARMA_REQUIRED} from '../features/bog-combat/entry.js';

const tabs=[['controls','Controls'],['world','World guide'],['bog','Bog']];
const emotes=[['Quack',['Q','1'],2],['Dance',['E'],3],['Heart',['2'],4],['Laugh',['3'],5],['Wave',['4'],6],['Sleep',['5'],7],['Grumpy',['6'],8],['Party',['7'],9]];
const camera=[['Follow your Ducky',['F']],['Zoom in / out',['+','−']],['Fit the island',['0']],['Return to your Ducky',['Home']],['Toggle sound',['M']]];
function Keys({keys,alternative=false}){return <span className="pixi-guide-keys">{keys.map((key,i)=><span key={key}>{i>0&&alternative&&<span className="pixi-guide-or">or</span>}<kbd>{key}</kbd></span>)}</span>;}
function Row({label,keys,children}){return <div><dt>{label}</dt><dd>{keys?<Keys keys={keys}/>:children}</dd></div>;}

export default function IslandGuide({island}){
 const trigger=useRef(null),dialog=useRef(null),content=useRef(null),tabRefs=useRef([]);
 const [tab,setTab]=useState('controls'),[opened,setOpened]=useState(false),[portraits,setPortraits]=useState({}),[overflow,setOverflow]=useState(false);
 function open(){island.current?.stopInput();setTab('controls');setOpened(true);dialog.current.showModal();content.current.scrollTop=0;}
 function select(value){setTab(value);content.current.scrollTop=0;}
 useEffect(()=>{
  if(!opened)return;
  let live=true,timer;
  const load=()=>{
   const renderer=island.current?.app?.renderer;
   if(!renderer){timer=setTimeout(load,250);return;}
   import('./guide-emotes.js').then(({prepareGuideEmotes})=>prepareGuideEmotes(renderer)).then(images=>{if(live)setPortraits(images);}).catch(()=>{});
  };
  load();
  return()=>{live=false;clearTimeout(timer);};
 },[opened,island]);
 useEffect(()=>{
  const node=content.current;if(!node)return;
  const update=()=>setOverflow(node.scrollHeight-node.clientHeight-node.scrollTop>8);
  update();node.addEventListener('scroll',update,{passive:true});
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(update);observer?.observe(node);if(node.firstElementChild)observer?.observe(node.firstElementChild);
  return()=>{node.removeEventListener('scroll',update);observer?.disconnect();};
 },[tab,opened,portraits]);
 function tabKey(event,index){
  const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
  if(next===null)return;event.preventDefault();select(tabs[next][0]);tabRefs.current[next]?.focus();
 }
 return <>
  <button ref={trigger} type="button" className="pixi-guide-button" onClick={open} aria-label="How to play" aria-haspopup="dialog" title="How to play">
   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .75-1.5 1-1.5 2.5M12 17h.01"/></svg>
  </button>
  <dialog ref={dialog} className="pixi-guide-dialog" aria-labelledby="pixi-guide-title" onClose={()=>{setOpened(false);trigger.current?.focus();}} onKeyDown={event=>event.stopPropagation()} onClick={event=>{if(event.target===event.currentTarget)dialog.current.close();}}>
   <header className="pixi-guide-header"><div><h2 id="pixi-guide-title">How to play</h2><p>A little help for your next adventure.</p></div>
    <button type="button" className="pixi-guide-close" aria-label="Close instructions" autoFocus onClick={()=>dialog.current.close()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button>
   </header>
   <div className="pixi-guide-tabs" role="tablist" aria-label="Help topics">{tabs.map(([id,label],i)=><button key={id} ref={node=>{tabRefs.current[i]=node;}} id={`guide-tab-${id}`} type="button" role="tab" aria-selected={tab===id} aria-controls="guide-panel" tabIndex={tab===id?0:-1} onKeyDown={event=>tabKey(event,i)} onClick={()=>select(id)}>{label}</button>)}</div>
   <div className="pixi-guide-scroll-wrap">
    <div ref={content} className="pixi-guide-content" id="guide-panel" role="tabpanel" aria-labelledby={`guide-tab-${tab}`} tabIndex={0}>
     {tab==='controls'&&<div className="pixi-guide-controls">
      <section><h3>Move & explore</h3><dl>
       <Row label="Walk"><Keys keys={['W','A','S','D']}/><span className="pixi-guide-or">or arrow keys</span></Row>
       <Row label="Run"><span className="pixi-guide-or">Hold</span><Keys keys={['Shift']}/><span className="pixi-guide-or">while moving</span></Row>
       <Row label="Jump" keys={['Space']}/><Row label="Board / leave a boat" keys={['Enter']}/><Row label="Chat nearby" keys={['C']}/>
      </dl></section>
      <section><div className="pixi-guide-section-heading"><h3>A little personality</h3><span>Emotes</span></div>
       <div className="pixi-guide-emotes">{emotes.map(([name,keys,action])=><div className="pixi-guide-emote" key={name}>{portraits[action]&&<img src={portraits[action]} alt="" width="72" height="72"/>}<strong>{name}</strong><Keys keys={keys} alternative/></div>)}</div>
      </section>
      <details className="pixi-guide-camera"><summary>Camera & sound <span>5 shortcuts</span></summary><dl>{camera.map(([label,keys])=><Row key={label} label={label} keys={keys}/>)}</dl></details>
      <p className="pixi-guide-note">In a Bog paint fight, hold Space or click to spray instead of jumping.</p>
     </div>}
     {tab==='world'&&<div className="pixi-guide-world">
      <section><h3>Make yourself at home</h3><p>Explore as a guest, or sign in with GitHub to play and save your Ducky’s spot. Dress up with caps, shades, accessories, and shoes.</p></section>
      <section><h3>Seven islands. Plenty to discover.</h3><p>Visit Homeland, Sunbob, Pagepond, Rosyblossom, Campfire, Iceland, and Booquack.</p><p>Skate on Iceland, visit Homeland’s museum, or stop by a telescope to take photos and find your star. Open the globe to explore the whole world.</p><p>Harbor teleporters cost {TELEPORT_COST} golden feathers per trip. Booquack also charges its entry fee.</p></section>
      <section><h3>Take the scenic route</h3><p>Board a boat at a port or along the shore. Sail between islands and out to the small islets. The sea wraps around the world.</p><p>Stranded on an islet? Find wood, rope, and sail cloth to build a boat on the shore.</p></section>
      <section><h3>Better with company</h3><p>Chat with nearby Duckies and make friends. Choose whether friends appear on your mini-map and globe. Take a Polaroid to save or share, and pick a track in the Ente Music player.</p></section>
     </div>}
     {tab==='bog'&&<div>
      <section className="pixi-guide-bog-intro"><span className="pixi-guide-eyebrow">Booquack</span><h3>A friendly paint fight</h3><p>Collect {KARMA_REQUIRED} golden feathers to unlock Bog. Pick Karma or Evil, then join an open paint fight. There’s no winning team or match countdown.</p></section>
      <section><h3>Aim. Hold. Spray.</h3><dl><Row label="Move" keys={['W','A','S','D']}/><Row label="Aim"><span>Move your mouse</span></Row><Row label="Spray"><span>Hold click</span><span className="pixi-guide-or">or</span><Keys keys={['Space']}/></Row></dl><p className="pixi-guide-note">Aim while you move. Your Ducky moves {RULES.moveSpeed}× faster in Bog.</p></section>
      <div className="pixi-guide-bog-stats"><div><strong>{RULES.ammoCapacity}</strong><span>droplets per tank</span></div><div><strong>{RULES.lives}</strong><span>hearts to start</span></div><div><strong>{RULES.hitsPerHeart}</strong><span>hits per heart</span></div></div>
      <section><h3>Stay in the splash</h3><p>An empty tank reloads automatically in {RULES.reloadSeconds} seconds. Keep holding to spray again after reloading. Stop firing to let a partly used tank top up.</p><p>Use bushes to hide. Losing a heart briefly takes you out of play; you return after {RULES.respawnDelay} seconds with {RULES.spawnShield} seconds of protection. Firing ends that protection early.</p><p>Lose all your hearts and you paddle back to a random islet. Collect feathers to join again.</p></section>
     </div>}
    </div>
    {overflow&&<div className="pixi-guide-scroll-hint" aria-hidden="true">More below ↓</div>}
   </div>
  </dialog>
 </>;
}
