import {RULES} from './rules.js';
import {KARMA_REQUIRED} from './entry.js';
import {trapFocus} from './BogDock.jsx';

const ART = '/pixi-art/themes/bog-arena/entry';
const TEAMS = {karma: 'Karma', evil: 'Evil'};   // Karma on the left, Evil on the right, as on the ticket

// The welcome ticket shown when you dock at the Bog: the island's own picture (the same one the globe uses) as the
// map, the two team Duckies on its corners, and the game's numbers printed on the stub. The notches are real cuts.
export function BogWelcome({dialog, onEnter, onExplore, onLeave, status}) {
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
          <div><dt>Popper</dt><dd>{RULES.ammoCapacity} droplets a tank</dd></div>
          <div><dt>Hearts</dt><dd>{RULES.lives}, {RULES.hitsPerHeart} droplets each</dd></div>
          <div><dt>Costs</dt><dd><img src="/pixi-art/karma/golden-feather.svg" alt=""/>{KARMA_REQUIRED} golden feathers</dd></div>
        </dl>
        <div className="bog-ticket-actions">
          <button className="bog-entry-primary" onClick={onEnter} autoFocus>Enter the Bog</button>
          {onExplore && <button className="bog-entry-link" onClick={onExplore}>Explore island</button>}
          <button className="bog-entry-link" onClick={onLeave}>{onExplore ? 'Back to boat' : 'Not now'}</button>
        </div>
        {status}
      </div>
    </section>
  </div>;
}

// Pick your side: the whole screen splits into the two teams across a slanted seam, the ticket's two Duckies facing off
// with their splats meeting at the "vs". Each side carries its name, head count and Join button.
export function BogTeamPick({dialog, data, onPlay, onLeave, leaveLabel, status}) {
  return <section ref={dialog} className="bog-pick" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="bog-pick-heading" onKeyDown={trapFocus}>
    <div className="bog-pick-side bog-pick-side-karma" aria-hidden="true"/>
    <div className="bog-pick-side bog-pick-side-evil" aria-hidden="true"/>
    <svg className="bog-pick-seam" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="54" y1="0" x2="46" y2="100"/></svg>
    <svg className="bog-pick-seam bog-pick-seam-phone" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="53" x2="100" y2="47"/></svg>
    <header className="bog-pick-head"><h1 id="bog-pick-heading"><small>Booquack Bog</small>Pick your side</h1></header>
    <button className="bog-pick-back" onClick={onLeave}>{leaveLabel}</button>
    {Object.entries(TEAMS).map(([id, name]) => <div key={id} className={`bog-pick-team bog-pick-${id}`}>
      <span className="bog-pick-shadow" aria-hidden="true"/>
      <img className="bog-pick-duck" src={`${ART}/${id}-corner.svg`} alt="" draggable="false"/>
      <div className="bog-pick-info">
        {data?.suggested === id && <span className="bog-pick-need">They need you</span>}
        <span className="bog-pick-name">{name}</span>
        <span className="bog-pick-count">{data ? `${data.counts[id]} ${data.counts[id] === 1 ? 'Ducky' : 'Duckies'} playing` : 'Counting Duckies…'}</span>
        <button className="bog-pick-join" disabled={!data} onClick={() => onPlay(id)}>Join {name}</button>
      </div>
    </div>)}
    <span className="bog-pick-vs" aria-hidden="true">vs</span>
    {status}
  </section>;
}
