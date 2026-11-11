// Walk up to a stargazing telescope and a "Look through the telescope" button appears. The Ducky walks to the eyepiece,
// then the night sky opens: one star for everyone who starred ente/ente (stargaze-sky.js draws it, /api/stars feeds it).

import {useEffect, useRef, useState} from 'react';
import {createStargazeSky} from './stargaze-sky.js';

const REFRESH_MS = 30_000;
// dev only (?offline): there is no room server to ask, so the sky shows this fixture
const OFFLINE_SKY = {total:30_000, me:{accountId:'1',login:'you',starred:true}, players:[['1','you']], online:['1'], friends:[]};
const STAR = 'M0 -8.5L2.6 -2.9 8.6 -2.3 4.1 1.8 5.3 7.8 0 4.8 -5.3 7.8 -4.1 1.8 -8.6 -2.3 -2.6 -2.9Z';
const Star = ({fill}) => <svg width="16" height="16" viewBox="-10 -10 20 20" aria-hidden="true">
  <path d={STAR} fill={fill} stroke="#39472d" strokeWidth="1.6" strokeLinejoin="round"/></svg>;
const Dot = ({fill, r}) => <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
  <circle cx="6" cy="6" r={r} fill={fill} stroke="#39472d" strokeWidth="1.2"/></svg>;

export default function IslandStargaze({island, playing, offline = false}) {
  const [near, setNear] = useState(false);
  const [walking, setWalking] = useState(false);
  const [open, setOpen] = useState(false);
  const [sky, setSky] = useState(null);
  const [error, setError] = useState('');
  const [news, setNews] = useState('');
  const dialog = useRef(null), stage = useRef(null), lens = useRef(null), canvas = useRef(null), tag = useRef(null), view = useRef(null);
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
    const stars = createStargazeSky({stage:stage.current, lens:lens.current, canvas:canvas.current, tag:tag.current, onNews:setNews});
    view.current = stars;
    stars.start();
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

  const total = sky ? Math.max(Number.isSafeInteger(sky.total) ? sky.total : 0, sky.players?.length ?? 0) : null;
  return <>
    {near && !open && <button className="pixi-travel-action" onClick={look} disabled={walking}>
      Look through the telescope <kbd>Enter</kbd>
    </button>}
    {open && <dialog ref={dialog} className="pixi-stargaze" aria-labelledby="stargaze-title" onClose={() => setOpen(false)}>
      <header className="pixi-stargaze-card">
        <h2 id="stargaze-title">{total === null ? 'Counting the stars…' : `${total.toLocaleString('en')} stars`}</h2>
        <p>One for everyone who starred ente/ente</p>
        <ul>
          <li><Star fill="#ffb937"/>Your star</li>
          <li><Star fill="#fff0b2"/>Ducks who have played here</li>
          <li><Dot fill="#409447" r="4.4"/>On the island right now</li>
          <li><Dot fill="#fff0c7" r="2.6"/>Stargazers who haven’t visited yet</li>
        </ul>
      </header>
      <div className="pixi-stargaze-stage" ref={stage}>
        <div className="pixi-stargaze-lens" ref={lens}>
          <canvas ref={canvas} aria-label="The night sky. Drag to look around, scroll or pinch to zoom, tap a star to see whose it is."/>
          <div className="pixi-stargaze-tag" ref={tag} hidden/>
          {news && <p className="pixi-stargaze-news" role="status">{news}</p>}
          {error && !sky && <p className="pixi-stargaze-news" role="alert">{error}</p>}
        </div>
      </div>
      <div className="pixi-stargaze-actions">
        <button onClick={() => view.current?.findMe()}>Find my star</button>
        {sky?.friends?.length > 0 && <button className="pixi-stargaze-quiet" onClick={() => view.current?.constellation()}>My constellation</button>}
        <button className="pixi-stargaze-quiet" aria-label="Zoom out" onClick={() => view.current?.zoom(1/1.7)}>−</button>
        <button className="pixi-stargaze-quiet" aria-label="Zoom in" onClick={() => view.current?.zoom(1.7)}>+</button>
        <button className="pixi-stargaze-quiet" onClick={() => view.current?.whole()}>Whole sky</button>
        <button className="pixi-stargaze-quiet" onClick={() => setOpen(false)}>Back to the island <kbd>Esc</kbd></button>
      </div>
    </dialog>}
  </>;
}
