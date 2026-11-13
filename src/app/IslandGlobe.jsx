import {useEffect, useRef} from 'react';

// The globe button beside the profile button. Zooming out stops at your own island; this is the only way onto the
// globe, with your pin, the Booquack Bog pin and hearts. Islands are reached by boat, not by zooming in.
export default function IslandGlobe({island, open, beside}) {
  const button = useRef(null);
  // the feather counter (signed-in players) also sits left of the profile button and changes width with the count:
  // keep the globe just left of it
  useEffect(() => {
    const place = () => {
      const counter = document.querySelector('.pixi-karma-counter'), el = button.current;
      if (!el) return;
      const r = counter?.getBoundingClientRect();
      el.style.right = r?.width ? `${Math.round(innerWidth - r.left + 10)}px` : '';
    };
    place();
    const id = setInterval(place, 500);
    addEventListener('resize', place);
    return () => {clearInterval(id); removeEventListener('resize', place);};
  }, []);
  useEffect(() => {
    if (!open) return;
    const key = event => {if (event.key === 'Escape') island.current?.closeGlobe();};
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, island]);

  return <button ref={button} type="button" className={`pixi-globe-button${beside ? ' pixi-globe-button--beside' : ''}`} aria-pressed={open}
    aria-label={open ? 'Back to your island' : 'Open the globe'} title={open ? 'Back to your island' : 'Globe'}
    onClick={() => {const game = island.current; if (!game) return; if (open) game.closeGlobe(); else game.openGlobe();}}>
    {open
      ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/></svg>
      : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#8fd3e6" stroke="currentColor" strokeWidth="2"/>
        <path d="M7.5 8.5c1.6-.8 3 .4 4.4-.2 1-.4 1.2 1.6 2.6 1.5 1.1 0 .9 2-.6 2.4-1.3.4-2.2 1.9-3.6 1.3-1.4-.6-.7-2.3-2-2.9-.9-.4-1.6-1.4-.8-2.1zM14.6 15.4c.9-.5 2.1-.1 2.3.7.2.9-1 1.8-2 1.6-.9-.2-1.1-1.8-.3-2.3z" fill="#93b72f" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>}
  </button>;
}
