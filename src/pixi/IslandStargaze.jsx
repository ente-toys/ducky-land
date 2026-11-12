
import {useEffect, useRef, useState} from 'react';
import {createStargazeSky, skyCounts} from './stargaze-sky.js';

const REFRESH_MS = 30_000;
const OFFLINE_SKY = {total:30_000, me:{accountId:'1',login:'you',starred:true}, online:['1','2','3','4'], friends:['2','6'],
  players:[['1','you'],['2','mallard'],['3','pekin'],['4','teal'],['5','eider'],['6','wigeon'],['7','pintail'],['8','gadwall']]};
const STAR = 'M0 -7.2L2.2 -2.5 7.3 -2 3.5 1.5 4.5 6.6 0 4.1 -4.5 6.6 -3.5 1.5 -7.3 -2 -2.2 -2.5Z';
const Star = ({level}) => <svg width="20" height="20" viewBox="-11 -11 22 22" aria-hidden="true">
  <circle r="11" fill="#16323c"/>{level === 1 && <circle r="8.6" fill="none" stroke="#ffb937" strokeWidth="1.2" opacity=".55"/>}
  <path d={STAR} fill="#ffb937" opacity={level} transform={level === 1 ? undefined : 'scale(.8)'}/></svg>;
const number = value => value.toLocaleString('en');

export default function IslandStargaze({island, playing, offline = false}) {
  const [near, setNear] = useState(false);
  const [walking, setWalking] = useState(false);
  const [open, setOpen] = useState(false);
  const [sky, setSky] = useState(null);
  const [error, setError] = useState('');
  const [news, setNews] = useState('');
  const dialog = useRef(null), stage = useRef(null), lens = useRef(null), canvas = useRef(null), tag = useRef(null), view = useRef(null);
  const active = playing || offline;

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
      <header className="pixi-stargaze-card">
        <h2 id="stargaze-title">{counts ? `${number(counts.total)} stars` : 'Counting the stars…'}</h2>
        <p>One for everyone who starred ente/ente</p>
        {counts && <ul>
          <li><Star level={1}/><span><b>{number(counts.online)}</b> online</span></li>
          <li><Star level={.62}/><span><b>{number(counts.offline)}</b> offline</span></li>
          <li><Star level={.34}/><span>Not starred yet</span></li>
        </ul>}
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
