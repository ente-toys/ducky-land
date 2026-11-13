
import {useEffect, useRef, useState} from 'react';
import {createStargazeSky, skyCounts} from '../rendering/pixi/stargaze-sky.js';

const REFRESH_MS = 30_000;
const OFFLINE_SKY = {total:30_088, me:{accountId:'1',login:'you',starred:true}, online:['1','2'], friends:['2','6'],
  players:[['1','you'],['2','mallard'],['3','pekin'],['4','teal'],['5','eider'],['6','wigeon'],['7','pintail'],['8','gadwall']]};
const number = value => value.toLocaleString('en');

export default function IslandStargaze({island, playing, offline = false}) {
  const [near, setNear] = useState(false);
  const [walking, setWalking] = useState(false);
  const [open, setOpen] = useState(false);
  const [sky, setSky] = useState(null);
  const [error, setError] = useState('');
  const dialog = useRef(null), stage = useRef(null), lens = useRef(null), canvas = useRef(null), tag = useRef(null), nameTag = useRef(null), view = useRef(null);
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
    const stars = createStargazeSky({stage:stage.current, lens:lens.current, canvas:canvas.current, tag:tag.current, nameTag:nameTag.current});
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
    if (!open) {setSky(null); setError(''); return;}
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
  const counts = sky ? skyCounts(sky) : null;
  return <>
    {near && !open && <button className="pixi-travel-action" onClick={look} disabled={walking}>
      Look through the telescope <kbd>Enter</kbd>
    </button>}
    {open && <dialog ref={dialog} className="pixi-stargaze" aria-labelledby="stargaze-title" onClose={() => setOpen(false)}>
      <button className="pixi-stargaze-close" aria-label="Back to the island" onClick={() => setOpen(false)} autoFocus>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg>
      </button>
      <div className="pixi-stargaze-stage" ref={stage}>
        <div className="pixi-stargaze-lens" ref={lens}>
          <canvas ref={canvas} tabIndex={0} aria-label="Night sky. Drag or use arrow keys to explore. Scroll, pinch, or use plus and minus to zoom. Home finds your star. Tap a star, or press Enter for the nearest star, to see its name."/>
          <button className="pixi-stargaze-tag" ref={tag} hidden title="Find your star">Your star</button>
          <div className="pixi-stargaze-tag pixi-stargaze-name" ref={nameTag} role="status" aria-live="polite" aria-atomic="true" hidden/>
          <header className="pixi-stargaze-counts">
            <h2 id="stargaze-title" aria-label={counts ? `${number(counts.total)} stars` : undefined}>
              {counts ? <>{number(counts.total)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.44 4.61 Q12.00 1.50 13.56 4.61 Q15.12 7.71 18.31 8.31 Q21.51 8.91 19.28 11.27 Q17.04 13.64 17.37 16.74 Q17.70 19.85 14.85 18.57 Q12.00 17.30 8.97 18.82 Q5.95 20.33 6.45 16.99 Q6.96 13.64 5.01 11.37 Q3.06 9.10 5.97 8.40 Q8.88 7.71 10.44 4.61 Z"/></svg></> : 'Counting the stars…'}
            </h2>
          </header>
        </div>
      </div>
      {error && <p className="pixi-stargaze-news" role="alert">{sky ? 'The sky could not refresh. Trying again…' : error}</p>}
    </dialog>}
  </>;
}
