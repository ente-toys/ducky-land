import {KARMA_REQUIRED} from './entry.js';
import {trapFocus} from './BogDock.jsx';

const ART = '/pixi-art/themes/bog-arena/entry';
const TEAMS = {evil: 'Evil', karma: 'Karma'};   // Evil on the left, Karma on the right

// The welcome ticket shown when you dock at the Bog: the island's own picture (the same one the globe uses) as the
// map, the two team Duckies on its corners, and the game's numbers printed on the stub. The notches are real cuts.
export function BogWelcome({dialog, onEnter, onLeave, status}) {
  return <div className="bog-entry">
    <section ref={dialog} className="bog-ticket" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="bog-ticket-heading" onKeyDown={trapFocus}>
      <div className="bog-ticket-paper" aria-hidden="true"><div className="bog-ticket-sheet"/></div>
      <div className="bog-ticket-map" aria-hidden="true">
        <img className="bog-ticket-island" src="/pixi-art/globe/bog.svg" alt="" draggable="false"/>
        <img className="bog-ticket-karma" src={`${ART}/karma-corner.svg`} alt="" draggable="false"/>
        <img className="bog-ticket-evil" src={`${ART}/evil-corner.svg`} alt="" draggable="false"/>
      </div>
      <div className="bog-ticket-stub">
        <p className="bog-ticket-admit">Admit one Ducky</p>
        <h1 id="bog-ticket-heading">Booquack Bog</h1>
        <p className="bog-ticket-lede">A paint fight in the swamp. You pick your side on the next screen.</p>
        <dl className="bog-ticket-fields">
          <div><dt>Team</dt><dd>Karma or Evil</dd></div>
          <div><dt>Popper</dt><dd>12 splats a load</dd></div>
          <div><dt>Hearts</dt><dd>5, one per splat</dd></div>
          <div><dt>Needs</dt><dd><img src="/pixi-art/karma/golden-feather.svg" alt=""/>{KARMA_REQUIRED} golden feathers</dd></div>
        </dl>
        <div className="bog-ticket-actions">
          <button className="bog-entry-primary" onClick={onEnter} autoFocus>Enter the Bog</button>
          <button onClick={onLeave}>Not now</button>
        </div>
        {status}
      </div>
    </section>
  </div>;
}

// Pick your side: the two teams face off across a "vs" badge, each with its Ducky bursting out of the panel and a
// live head count. Tapping a side joins that team straight away.
export function BogTeamPick({dialog, data, onPlay, onLeave, leaveLabel, status}) {
  return <div className="bog-entry">
    <section ref={dialog} className="bog-pick" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="bog-pick-heading" onKeyDown={trapFocus}>
      <header className="bog-pick-head">
        <h1 id="bog-pick-heading"><small>Booquack Bog</small>Pick your side</h1>
        <button onClick={onLeave}>{leaveLabel}</button>
      </header>
      <div className="bog-pick-cards">
        {Object.entries(TEAMS).map(([id, name]) => <button key={id} className={`bog-pick-card bog-pick-${id}`}
          disabled={!data} onClick={() => onPlay(id)}>
          <img src={`${ART}/${id}-action.svg`} alt="" draggable="false"/>
          <span className="bog-pick-label">
            <span><span className="bog-pick-name">{name}</span>
              <span className="bog-pick-count">{data ? `${data.counts[id]} ${data.counts[id] === 1 ? 'Ducky' : 'Duckies'} playing` : 'Counting Duckies…'}</span></span>
            <span className="bog-pick-join" aria-hidden="true">Join</span>
          </span>
          {data?.suggested === id && <span className="bog-pick-need">They need you</span>}
        </button>)}
        <span className="bog-pick-vs" aria-hidden="true">vs</span>
      </div>
      <p className="bog-pick-help"><kbd>WASD</kbd> move <kbd>Shift</kbd> run <kbd>Space</kbd> shoot</p>
      {status}
    </section>
  </div>;
}
