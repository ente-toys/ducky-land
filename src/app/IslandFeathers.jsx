import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {KARMA_REQUIRED} from '../features/bog-combat/entry.js';

// The feather chip next to the profile button is drawn by the game (karma-view.js). Clicking it opens a card that
// explains golden feathers: the same glowing feather as on the islands, how many you have, and what they unlock.
export default function IslandFeathers({island}) {
  const [count,setCount] = useState(null);

  useEffect(() => {
    let chip = null;
    const open = () => {
      island.current?.stopInput?.();
      setCount(Number(chip?.dataset.karma ?? 0) || 0);
    };
    const click = event => {if (event.target.closest?.('.pixi-karma-counter')) open();};
    const key = event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.closest?.('.pixi-karma-counter')) {event.preventDefault(); open();}
    };
    // the chip appears once the game has loaded; make it a real button for keyboards and screen readers
    const id = setInterval(() => {
      const found = document.querySelector('.pixi-karma-counter');
      if (!found || found === chip) return;
      chip = found;
      chip.setAttribute('role','button');
      chip.setAttribute('tabindex','0');
      chip.setAttribute('aria-label','Golden feathers, what they are for');
    }, 500);
    window.addEventListener('click', click);
    window.addEventListener('keydown', key);
    return () => {clearInterval(id); window.removeEventListener('click', click); window.removeEventListener('keydown', key);};
  }, [island]);

  return count !== null && createPortal(<FeatherCard count={count} onClose={() => setCount(null)}/>, document.body);
}

function FeatherCard({count, onClose}) {
  const dialog = useRef(null);
  const left = Math.max(0, KARMA_REQUIRED - count);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    element.querySelector('.pixi-feather-done')?.focus({focusVisible:false});
    return () => element.close();
  }, []);

  return <dialog ref={dialog} className="pixi-feather-dialog" aria-labelledby="feather-title"
    onClose={onClose} onKeyDown={event => event.stopPropagation()}
    onClick={event => {if (event.target === event.currentTarget) onClose();}}>
    <button className="pixi-feather-close" type="button" aria-label="Close" onClick={onClose}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>
    </button>
    <div className="pixi-feather-hero" aria-hidden="true">
      <span className="pixi-feather-halo"/>
      <span className="pixi-feather-bob">
        <img src="/pixi-art/karma/golden-feather.svg" alt="" draggable="false"/>
        <span className="pixi-feather-sweep"/>
      </span>
      <span className="pixi-feather-spark pixi-feather-spark-a"/>
      <span className="pixi-feather-spark pixi-feather-spark-b"/>
    </div>
    <h2 id="feather-title">Golden feathers</h2>
    <p className="pixi-feather-lead">Glowing feathers lie around the islands. Walk into one to pick it up.</p>
    {/* under 5 the slots count down to Booquack Bog; from 5 up there is nothing left to fill, so show the total and the unlock */}
    {left ? <>
      <div className="pixi-feather-progress" role="img" aria-label={`${count} of ${KARMA_REQUIRED} feathers`}>
        {Array.from({length:KARMA_REQUIRED}, (_,n) => <span key={n} className={n < count ? 'is-filled' : ''} style={{'--i':n}}/>)}
      </div>
      <p className="pixi-feather-count">You have <b>{count}</b>. Collect <b>{left}</b> more.</p>
    </> : <div className="pixi-feather-total">
      <p className="pixi-feather-big"><b>{count.toLocaleString()}</b><img src="/pixi-art/karma/golden-feather.svg" alt=""/></p>
    </div>}
    <ul className="pixi-feather-perks">
      <li>{left ? <><b>{KARMA_REQUIRED} feathers</b> let you land on Booquack Bog, the paint splat arena.</> : <><b>Booquack Bog is open.</b> Sail there for a paint splat match.</>}</li>
      <li>Every feather you hold shows in the quiver on your Ducky's back.</li>
    </ul>
    <button className="pixi-feather-done" type="button" autoFocus onClick={onClose}>Got it</button>
  </dialog>;
}
