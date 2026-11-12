// Walk up to a stargazing telescope and a "Look through the telescope" button appears. The Ducky walks to the eyepiece,
// then the night sky opens: one star for everyone who starred ente/ente (stargaze-sky.js draws it, /api/stars feeds it).

import {useEffect, useRef, useState} from 'react';
import {createStargazeSky, skyCounts} from './stargaze-sky.js';
import astronautSvg from './assets/space-ducky.svg?raw';
import {blinkingAstronaut} from './space-ducky.js';
import {DEMO_SKY} from './stargaze-demo.js';

const ASTRONAUT_MARKUP=blinkingAstronaut(astronautSvg);
const REFRESH_MS = 30_000;
// dev only (?dev=1 or ?offline): there is no room server to ask, so the sky shows this fixture
const OFFLINE_SKY=DEMO_SKY;
const STAR = 'M0 -7.2L2.2 -2.5 7.3 -2 3.5 1.5 4.5 6.6 0 4.1 -4.5 6.6 -3.5 1.5 -7.3 -2 -2.2 -2.5Z';
// The owner badge uses the same green as the owner point in the universe.
const Star = ({level}) => <svg width="20" height="20" viewBox="-11 -11 22 22" aria-hidden="true">
  <path d={STAR} fill="#08c225" opacity={level} transform={level === 1 ? undefined : 'scale(.8)'}/></svg>;
const number = value => value.toLocaleString('en');
const Icon=()=> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>;

export default function IslandStargaze({island, playing, offline = false}) {
  const [near, setNear] = useState(false);
  const [walking, setWalking] = useState(false);
  const [open, setOpen] = useState(false);
  const [sky, setSky] = useState(null);
  const [error, setError] = useState('');
  const [news, setNews] = useState('');
  const dialog = useRef(null), stage = useRef(null), lens = useRef(null), canvas = useRef(null), tag = useRef(null), owner=useRef(null), astronaut=useRef(null), view = useRef(null);
  const active = playing || offline;

  // the boat button owns the same place on screen, so the telescope waits its turn
  useEffect(() => {
    if (!active) {setNear(false); setWalking(false); return;}
    const id = setInterval(() => {
      const game = island.current, travel = game?.travelOptions?.() ?? {};
      setNear(Boolean(game?.telescopeOptions?.().telescope) && !travel.take && !travel.dock);
    }, 250);
    return () => clearInterval(id);
  }, [active, island]);

  function look() {
    if (walking || open || !island.current?.telescopeAction?.()) return;
    setWalking(true);
  }

  // Enter looks through the telescope you are next to, like Enter takes the boat you are next to
  useEffect(() => {
    if (!near || open || walking) return;
    const key = event => {
      if (event.key !== 'Enter' || event.repeat || event.metaKey || event.ctrlKey || event.altKey ||
        /INPUT|TEXTAREA|SELECT|BUTTON|^A$/.test(event.target?.tagName) || event.target?.isContentEditable) return;
      look();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  // the sky opens once the Ducky is at the eyepiece, or after a few seconds if something is in its way
  useEffect(() => {
    if (!walking) return;
    const started = performance.now();
    const id = setInterval(() => {
      const options = island.current?.telescopeOptions?.() ?? {};
      if (!options.telescope) setWalking(false);
      else if (options.at || performance.now()-started > 6000) {setWalking(false); setOpen(true);}
    }, 120);
    return () => clearInterval(id);
  }, [walking, island]);

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    island.current?.stopInput();
    element.showModal();
    const stars = createStargazeSky({stage:stage.current, lens:lens.current, canvas:canvas.current, tag:tag.current, owner:owner.current, astronaut:astronaut.current, onNews:setNews});
    view.current = stars;
    stars.start();
    canvas.current?.focus({preventScroll:true});
    // the island must not hear walking keys while you stargaze; Escape still closes the dialog
    const quiet = event => {if (event.key !== 'Escape') event.stopPropagation();};
    element.addEventListener('keydown', quiet);
    return () => {
      element.removeEventListener('keydown', quiet);
      stars.dispose();
      view.current = null;
      if (element.open) element.close();
    };
  }, [open, island]);

  useEffect(() => {
    if (!open) {setSky(null); setError(''); setNews(''); return;}
    let stopped = false, timer = 0;
    const load = async () => {
      try {
        let data = OFFLINE_SKY;
        if (!offline) {
          const response = await fetch('/api/stars');
          data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || '');
        }
        if (!stopped) {setSky(data); setError('');}
      } catch (failure) {
        if (!stopped) setError(failure.message || 'The telescope is clouded over. Please try again.');
      }
      if (!stopped) timer = setTimeout(load, REFRESH_MS);
    };
    load();
    return () => {stopped = true; clearTimeout(timer);};
  }, [open, offline]);

  useEffect(() => {if (open && sky) view.current?.setData(sky);}, [open, sky]);
  useEffect(() => {
    if (!news) return;
    const id = setTimeout(() => setNews(''), 4200);
    return () => clearTimeout(id);
  }, [news]);

  const counts = sky ? skyCounts(sky) : null;
  return <>
    {near && !open && <button className="pixi-travel-action" onClick={look} disabled={walking}>
      Look through the telescope <kbd>Enter</kbd>
    </button>}
    {open && <dialog ref={dialog} className="pixi-stargaze" aria-labelledby="stargaze-title" onClose={() => setOpen(false)}>
      <header className="pixi-stargaze-bar">
        <h2 id="stargaze-title">Our constellation</h2>
        <span className="pixi-stargaze-total" title={counts?`${number(counts.offline)} offline stargazers`:'Counting the stars'}>{counts ? `${number(counts.total)} stars` : 'Counting…'}</span>
        {counts&&<span className="pixi-stargaze-online"><i/>{number(counts.online)} online</span>}
      </header>
      <button className="pixi-stargaze-close" aria-label="Close telescope" onClick={()=>setOpen(false)}><Icon kind="close"/></button>
      <div className="pixi-stargaze-stage" ref={stage}>
        <div className="pixi-stargaze-lens" ref={lens}>
          <canvas ref={canvas} tabIndex={0} aria-label="Surrounding 3D star field. Hover or tap a star for its name. Drag to turn and look around you. Use arrow keys to look, plus and minus to focus, Home to find your star, 0 to reset the lens, R to replay arrival."/>
          <div className="pixi-space-ducky" ref={astronaut} aria-hidden="true" hidden><div className="pixi-space-ducky-art" dangerouslySetInnerHTML={{__html:ASTRONAUT_MARKUP}}/></div>
          <button className="pixi-stargaze-you" ref={owner} hidden={!sky?.me?.starred} onClick={()=>view.current?.findMe()} aria-label="Find your star"><Star level={1}/><span>@{sky?.me?.login}<small>Your star <b className="pixi-stargaze-edge-arrow">↗</b></small></span></button>
          <div className="pixi-stargaze-tag" ref={tag} role="status" aria-live="polite" hidden/>
          {news && <p className="pixi-stargaze-news" role="status">{news}</p>}
          {error && !sky && <p className="pixi-stargaze-news" role="alert">{error}</p>}
        </div>
      </div>
      <div className="pixi-stargaze-optics" aria-hidden="true"/>
      <div className="pixi-stargaze-hint"><span className="pixi-stargaze-desktop-hint">Hover a star · Drag to look around you · Scroll to focus</span><span className="pixi-stargaze-touch-hint">Tap a star · Drag to look around you · Pinch to focus</span>{offline&&<small>Local preview · sample identities · Press R to replay arrival</small>}</div>
    </dialog>}
  </>;
}
