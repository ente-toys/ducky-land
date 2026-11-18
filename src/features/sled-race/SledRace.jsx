import {useEffect, useRef, useState} from 'react';
import {Application} from 'pixi.js';
import {createSledView, loadSledArt} from './view.js';
import {createSledRace} from './sim.js';
import {createBotDrivers} from './bots.js';
import {raceAchievements} from './achievements.js';
import './sled.css';

const ordinal = n => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const COUNTDOWN = 3;
// placings while some are still sliding: finished racers by place, then the rest by how far down they are
const soFar = racers => [...racers].sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity) || b.d - a.d)
  .map(r => ({id: r.id, name: r.name, bot: r.bot, place: r.place, finishedAt: r.finishedAt, dnf: r.dnf}));

// Keyboard and touch to {steer, tuck, jump}: Left/Right or A/D steer, Up or W tucks, Space hops; on touch the
// screen halves steer, holding both tucks, and the Jump button hops. With both directions held, the one pressed last
// wins. Held keys are forgotten when the window loses focus, since their key-up never arrives then.
const STEER = {arrowleft: -1, a: -1, arrowright: 1, d: 1}, TUCK = new Set(['arrowup', 'w']), JUMP = ' ';
function useSledInput(active) {
  const keys = useRef(new Set()), order = useRef([]), touches = useRef(new Map()), tapped = useRef(-Infinity);
  useEffect(() => {
    if (!active) return undefined;
    const forget = () => {keys.current.clear(); order.current = []; touches.current.clear();};
    const down = e => {
      const k = e.key.toLowerCase();
      if (!(k in STEER) && !TUCK.has(k) && k !== JUMP) return;
      e.preventDefault(); e.stopPropagation(); keys.current.add(k);
      if (k in STEER) order.current = [...order.current.filter(o => o !== k), k];
    };
    const up = e => {const k = e.key.toLowerCase(); if (k === JUMP) e.preventDefault(); keys.current.delete(k); order.current = order.current.filter(o => o !== k);};
    const touch = e => {if (e.target?.closest?.('button')) return; for (const t of e.changedTouches) {if (e.type === 'touchstart' || e.type === 'touchmove') touches.current.set(t.identifier, t.clientX < innerWidth / 2 ? -1 : 1); else touches.current.delete(t.identifier);}};
    const hidden = () => {if (document.hidden) forget();};
    addEventListener('keydown', down, true); addEventListener('keyup', up, true); addEventListener('blur', forget);
    document.addEventListener('visibilitychange', hidden);
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) addEventListener(type, touch, {passive: true});
    return () => {
      removeEventListener('keydown', down, true); removeEventListener('keyup', up, true); removeEventListener('blur', forget);
      document.removeEventListener('visibilitychange', hidden);
      for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) removeEventListener(type, touch);
      forget();
    };
  }, [active]);
  const read = () => {
    const k = keys.current, sides = new Set(touches.current.values()), last = order.current.at(-1);
    const keySteer = last ? STEER[last] : 0, touchSteer = sides.has(-1) && sides.has(1) ? 0 : sides.has(-1) ? -1 : sides.has(1) ? 1 : 0;
    // a tap counts as a press for a moment, so an online race does not miss it between input sends
    const jump = k.has(JUMP) || performance.now() - tapped.current < 150;
    return {steer: keySteer || touchSteer, tuck: [...TUCK].some(t => k.has(t)) || (sides.has(-1) && sides.has(1)), jump};
  };
  read.jump = () => {tapped.current = performance.now();};
  return read;
}

// One race on screen. A practice race (no `client`) runs the whole race here with bots; an online race shows the
// server's race and sends this player's steering to it.
export default function SledRace({course, racers, me, client = null, skill = .5, onAgain, onLeave}) {
  const host = useRef(null), photo = useRef(null);
  const [phase, setPhase] = useState('loading');
  const [hud, setHud] = useState({place: 1, time: 0, progress: [], boost: false, count: COUNTDOWN});
  const [results, setResults] = useState(null);
  const input = useSledInput(phase === 'countdown' || phase === 'racing');
  useEffect(() => {
    if (!onLeave) return undefined;
    const leave = e => {if (e.key === 'Escape') {e.preventDefault(); onLeave();}};
    addEventListener('keydown', leave);
    return () => removeEventListener('keydown', leave);
  }, [onLeave]);

  useEffect(() => {
    let disposed = false, ready = false, app, view, frame, last = performance.now(), started = 0, photoTaken = false, shownAt = -Infinity;
    const race = client ? null : createSledRace({course, racers, bots: createBotDrivers(course, {seed: course.seed, skill})});
    // an online race shows the racers on their start line until the server's first update arrives
    const start = client ? createSledRace({course, racers}).state : null;
    const stateOf = () => client ? (client.frames.length ? client.view() : start) : race.state;
    (async () => {
      app = new Application();
      await app.init({resizeTo: host.current, antialias: true, background: '#e6f1f8', resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true, preference: 'webgl'});
      ready = true;
      if (disposed) {app.destroy({removeView: true}, {children: true}); return;}
      host.current.append(app.canvas);
      await loadSledArt();
      view = await createSledView(app, {course, racers, me});
      if (disposed) return;
      setPhase('countdown'); started = performance.now();
      const tick = now => {
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        const wait = client ? client.countdown() : COUNTDOWN - (now - started) / 1000;
        let events = [];
        if (wait > 0) setHud(h => h.count === Math.ceil(wait) ? h : {...h, count: Math.ceil(wait)});
        else {
          if (client) {client.steer(input()); events = client.drainEvents();}
          else if (!race.state.done) {race.input(me, input()); race.step(dt); events = race.drainEvents();}
          setPhase(p => p === 'countdown' ? 'racing' : p);
        }
        const state = stateOf();
        view.update(state, dt, {events, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches});
        // photo finish: the frame the winner crosses the line
        if (!photoTaken && events.some(e => e.type === 'finish' && e.place === 1)) {
          photoTaken = true;
          // a half-size grab, after this frame, so the race does not hitch
          setTimeout(() => {if (!disposed) app.renderer.extract.base64({target: app.stage, format: 'jpg', quality: .85, resolution: .5}).then(url => {photo.current = url;}).catch(() => {});});
        }
        const mine = state.racers.find(r => r.id === me);
        if (mine) {
          const ahead = state.racers.filter(r => r.id !== me && ((r.place ?? Infinity) < (mine.place ?? Infinity) || (r.place == null && mine.place == null && r.d > mine.d))).length;
          setHud(h => ({...h, place: mine.place ?? ahead + 1, time: Math.max(0, state.time), boost: state.time < mine.boostUntil, crashed: state.time < mine.crashUntil,
            progress: state.racers.map(r => ({id: r.id, name: r.name, bot: r.bot, at: Math.min(1, r.d / course.length), me: r.id === me}))}));
        }
        // the results open as soon as you cross the line; the others fill in as they finish
        const final = client ? client.finished() : state.done;
        if (final || mine?.finishedAt != null) {
          if (final || now - shownAt > 400) {
            shownAt = now;
            const standings = final ? (client ? client.standings() : race.standings()) : soFar(state.racers);
            setResults({standings, final, achievements: final ? raceAchievements({me: standings.find(r => r.id === me), course, standings}) : []});
            setPhase('results');
          }
          if (final) {app.render(); return;}
        }
        app.render(); frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    })().catch(error => {console.error(error); setPhase('error');});
    return () => {disposed = true; cancelAnimationFrame(frame); view?.destroy(); if (ready) app.destroy({removeView: true}, {children: true});};
  }, [course, racers, me, client]);

  const savePhoto = () => {if (!photo.current) return; const a = document.createElement('a'); a.href = photo.current; a.download = `${course.name} photo finish.jpg`; a.click();};
  return <div className="sled-race" role="application" aria-label={`Sled race: ${course.name}`}>
    <div className="sled-race-canvas" ref={host}/>
    {phase === 'loading' && <p className="sled-race-note">Waxing the tubes…</p>}
    {phase === 'error' && <p className="sled-race-note">The hill didn't load. <button onClick={onLeave}>Back</button></p>}
    {(phase === 'countdown' || phase === 'racing') && <>
      <div className="sled-hud-place"><strong>{ordinal(hud.place)}</strong><span>of {racers.length}</span></div>
      <div className="sled-hud-course"><span>{course.name}</span><strong>{hud.time.toFixed(1)}s</strong></div>
      <button className="sled-hud-leave" onClick={onLeave}>Leave <kbd>Esc</kbd></button>
      <ol className="sled-hud-rail" aria-hidden="true">{hud.progress.map(p => <li key={p.id} className={p.me ? 'me' : p.bot ? 'bot' : ''} style={{'--at': p.at}} title={p.name}/>)}</ol>
      {hud.boost && <p className="sled-hud-flag boost">Ice boost!</p>}
      {hud.crashed && <p className="sled-hud-flag crash">Wipeout!</p>}
      {phase === 'countdown' && <p className="sled-hud-count" key={hud.count}>{hud.count}</p>}
      <p className="sled-hud-keys">Steer <kbd>←</kbd><kbd>→</kbd> · Tuck <kbd>↑</kbd> · Jump <kbd>Space</kbd></p>
      <button className="sled-hud-jump" onPointerDown={e => {e.preventDefault(); input.jump();}}>Jump</button>
    </>}
    {phase === 'results' && results && <div className="sled-results" role="dialog" aria-label="Race results">
      <h2>{course.name}</h2>
      <ol>{results.standings.map(r => <li key={r.id} className={r.id === me ? 'me' : ''}>
        <span className="place">{r.place ? ordinal(r.place) : '—'}</span><span className="name">{r.name}{r.bot && <em>BOT</em>}</span>
        <span className="time">{r.finishedAt == null ? 'racing…' : r.dnf ? '—' : `${r.finishedAt.toFixed(2)}s`}</span>
      </li>)}</ol>
      {results.achievements.length > 0 && <ul className="sled-medals">{results.achievements.map(a => <li key={a.id}><strong>{a.title}</strong> {a.text}</li>)}</ul>}
      <div className="sled-results-actions">
        {photo.current && <button onClick={savePhoto}>Save photo finish</button>}
        {onAgain && <button className="primary" onClick={onAgain} disabled={!results.final}>Race again</button>}
        <button onClick={onLeave}>Back to the hill</button>
      </div>
    </div>}
  </div>;
}
