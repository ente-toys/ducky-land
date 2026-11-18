// The sled hill island: standing at its tube rental stall shows a small Sled race button (with the waiting count);
// tapping it opens the card to join the next race, practise against bots, or carry on. Joining shows the lobby until
// the race starts.
import {useEffect, useRef, useState} from 'react';
import SledRace from './SledRace.jsx';
import {SledClient} from './client.js';
import {createHillIslandArt, createSledIslandView} from './island-view.js';
import {buildCourse, seededRandom} from './course.js';
import {botRoster} from './bots.js';
import {raceSeed} from './lobby.js';
import {randomOutfit} from '../../gameplay/outfits.js';
import {SLED, SLED_ISLAND, SLED_ZONE, SLED_ZONE_RADIUS, SLED_WATCH_RADIUS} from './rules.js';
import {mapOf} from '../../world/island-maps.js';
import './sled.css';

const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.max(0, Math.ceil(seconds) % 60)).padStart(2, '0')}`;

// how far the player is from the sled hill's tube rental stall (Infinity off the snow island or not on foot)
function hillDistance(game) {
  const p = game?.player;
  if (p?.islandId !== SLED_ISLAND || p.mode !== 'walking') return Infinity;
  const hill = mapOf(SLED_ISLAND).world.zones[SLED_ZONE];
  return Math.hypot(p.x - hill.x, p.y - hill.y);
}

export default function SledEntry({island, playing, name = 'Ducky'}) {
  const [near, setNear] = useState(false);
  const [watching, setWatching] = useState(false);
  const [onSnow, setOnSnow] = useState(false);
  const [open, setOpen] = useState(false);
  const [lobby, setLobby] = useState(null);
  const [practice, setPractice] = useState(null);
  const [race, setRace] = useState(null);
  const [now, setNow] = useState(0);
  const [retry, setRetry] = useState(0);
  const client = useRef(null), dialog = useRef(null);

  // at the stall (the Sled race button), or close enough to watch the race on the hill?
  useEffect(() => {
    if (!playing) {setNear(false); setWatching(false); setOnSnow(false); return undefined;}
    const id = setInterval(() => {
      const d = hillDistance(island.current); setNear(d <= SLED_ZONE_RADIUS); setWatching(d <= SLED_WATCH_RADIUS);
      setOnSnow(island.current?.player?.islandId === SLED_ISLAND);
    }, 250);
    return () => clearInterval(id);
  }, [playing, island]);

  // watch the hill's room while nearby (or while seated); a dropped connection comes back after a second
  const seated = Boolean(client.current?.seated());
  useEffect(() => {
    if (!watching && !seated) {const c = client.current; client.current = null; c?.close(); setLobby(null); return undefined;}
    if (client.current) return undefined;
    const c = new SledClient({onState: setLobby, onClose: () => {
      if (client.current !== c) return;
      client.current = null; setLobby(null); setTimeout(() => setRetry(n => n + 1), 1000);
    }});
    client.current = c;
    return undefined;
  }, [watching, seated, retry]);
  // walking away from the stall closes the race card
  useEffect(() => {if (!near && !client.current?.seated()) setOpen(false);}, [near]);

  // the hill island itself, drawn into the snow island's scene while we are on it
  useEffect(() => {
    const game = island.current;
    if (!onSnow || !game?.objects) return undefined;
    let art = null, gone = false;
    createHillIslandArt(game).then(a => {if (gone) a.destroy(); else art = a;})
      .catch(error => console.error('Could not draw the sled hill island', error));
    return () => {gone = true; art?.destroy();};
  }, [onSnow, island]);

  // the race on the hill, drawn into the island for everyone watching
  useEffect(() => {
    const game = island.current;
    if (!watching || !game?.objects) return undefined;
    let view = null, gone = false;
    createSledIslandView(game.objects).then(v => {
      if (gone) {v.destroy(); return;}
      view = v; game.sledHill = {update: () => {const c = client.current; if (c) view.update(c.lobby);}, focus: () => view.focus()};
    }).catch(error => console.error('Could not draw the sled race on the hill', error));
    return () => {gone = true; if (game.sledHill) delete game.sledHill; view?.destroy();};
  }, [watching, island]);
  useEffect(() => () => {const c = client.current; client.current = null; c?.close();}, []);

  // the lobby timer ticks on screen
  useEffect(() => {
    if (!open || !lobby?.endsAt) return undefined;
    const id = setInterval(() => setNow(client.current?.serverNow() ?? 0), 250);
    return () => clearInterval(id);
  }, [open, lobby?.endsAt]);

  // the pop-up holds the duck still and closes on Escape
  useEffect(() => {
    if (!open) return undefined;
    island.current?.stopInput?.();
    const key = e => {if (e.key === 'Escape') {e.preventDefault(); setOpen(false);}};
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [open, island]);
  useEffect(() => {if (open) dialog.current?.querySelector('button')?.focus();}, [open, Boolean(lobby)]);

  const me = client.current?.id, mySeat = lobby?.seats?.find(s => s.id === me), waiting = lobby?.seats?.length ?? 0;
  // our race starts: keep it on screen (results included) until we leave it
  const startedSeed = lobby?.racers?.some(r => r.id === me) ? lobby.seed : null;
  useEffect(() => {
    if (startedSeed != null && race?.course.seed !== startedSeed) {setRace({course: buildCourse(startedSeed), racers: lobby.racers}); setOpen(false);}
  }, [startedSeed]);

  function startPractice() {
    const seed = raceSeed();
    const dress = seededRandom(seed);
    setPractice({course: buildCourse(seed), racers: [{id: 'me', name, colour: 0, outfit: island.current?.player?.outfit ?? null},
      ...botRoster(SLED.practiceBots, {seed}).map((b, i) => ({...b, colour: i + 1, outfit: randomOutfit(undefined, dress)}))]});
    setOpen(false);
  }
  // back on the island after a race: the camera finds our duck where the race put it
  const backToIsland = () => {const game = island.current; game?.landOnPlayer?.(game.camera?.zoom);};
  const leaveRace = () => {client.current?.leaveSeat(); setRace(null); setOpen(false); backToIsland();};

  if (practice) return <SledRace key={practice.course.seed} course={practice.course} racers={practice.racers} me="me"
    onAgain={startPractice} onLeave={() => {setPractice(null); backToIsland();}}/>;
  if (race) return <SledRace key={race.course.seed} course={race.course} racers={race.racers} me={me} client={client.current}
    onAgain={() => {setRace(null); client.current?.join(); setOpen(true);}} onLeave={leaveRace}/>;

  return <>
    {near && !open && <button className="pixi-travel-action" onClick={() => setOpen(true)}>
      Sled race{waiting ? ` · ${waiting} waiting` : ''}
    </button>}
    {open && <div className="sled-entry" role="dialog" aria-modal="true" aria-labelledby="sled-entry-title" ref={dialog}>
      <div className="sled-entry-card">
        <h2 id="sled-entry-title">Sled Hill</h2>
        {!mySeat ? <>
          <p>Race down the hill on a snow tube. Steer around rocks and logs, slide over ice to go faster.</p>
          <p className="sled-entry-count">{waiting ? `${waiting} of ${lobby?.max ?? SLED.maxSeats} waiting` : 'Nobody is waiting yet. Bots will race you.'}
            {lobby?.phase === 'waiting' && <> · starts in {clock(lobby.endsAt - now)}</>}</p>
          {lobby?.busy === 'racing' && <p className="sled-entry-note">A race is on. You can join the next one.</p>}
          {lobby?.busy === 'full' && <p className="sled-entry-note">All {lobby.max ?? SLED.maxSeats} tubes are taken. You can join the next race.</p>}
          <div className="sled-entry-actions">
            <button className="primary" onClick={() => client.current?.join()} disabled={!lobby || lobby.phase === 'racing' || lobby.phase === 'countdown' || waiting >= (lobby.max ?? SLED.maxSeats)}>Join race</button>
            <button onClick={startPractice}>Practice with bots</button>
            <button onClick={() => setOpen(false)}>Not now</button>
          </div>
        </> : <>
          <p className="sled-entry-count">{lobby.phase === 'waiting' ? <>Starts in {clock(lobby.endsAt - now)} · races at {SLED.minHumans} ready, bots fill in after the wait</> : 'Getting ready…'}</p>
          <ol className="sled-entry-seats">
            {lobby.seats.map(s => <li key={s.id} className={s.id === me ? 'me' : ''}><span>{s.name}</span><b>{s.ready ? 'Ready' : 'Waiting'}</b></li>)}
          </ol>
          <div className="sled-entry-actions">
            <button className="primary" onClick={() => client.current?.ready(!mySeat.ready)}>{mySeat.ready ? 'Not ready' : 'Ready'}</button>
            <button onClick={leaveRace}>Leave</button>
          </div>
        </>}
      </div>
    </div>}
  </>;
}
