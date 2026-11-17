import {useEffect, useRef, useState} from 'react';
import {PixiIsland} from '../rendering/pixi/engine.js';
import {RoomClient} from '../multiplayer/room-client.js';
import IslandChat from './IslandChat.jsx';
import IslandPresence from './IslandPresence.jsx';
import StarDialog from './StarDialog.jsx';
import ArrivalClouds from './ArrivalClouds.jsx';
import {arrivalPending,rememberSignedIn} from './arrival.js';
import IslandConnecting from './IslandConnecting.jsx';
import IslandTravel from './IslandTravel.jsx';
import IslandStargaze from './IslandStargaze.jsx';
import IslandProfile from './IslandProfile.jsx';
import IslandCamera from './IslandCamera.jsx';
import IslandMusic from './IslandMusic.jsx';
import WorldMap from './WorldMap.jsx';
import BogEntry from '../features/bog-combat/BogEntry.jsx';
import {BOG_COMBAT} from '../features/bog-combat/config.js';
import {startHomeHeadStart,settleHomeHeadStart,finishHomeHeadStart} from './home-head-start.js';
import {startupSession} from './arrival-start.js';
import './pixi.css';
import './star-dialog.css';

// statuses shown in the middle of the screen (the rest stay top right)
const CENTRE = new Set(['connecting', 'reconnecting', 'taken-over', 'spectators-full', 'expired']);
const notices = {
  connecting:'Connecting to your island…',
  reconnecting:'Reconnecting…',
  'spectators-full':'Live view is full.',
  'players-full':'There’s no room to join right now. You can still watch.',
  'taken-over':'Your duck is playing in another tab.',
  expired:'Your session expired.',
  'star-required':'Star ente/ente to explore and play.',
};

const authNotices = {
  cancelled:'GitHub sign-in was cancelled.',
  failed:'GitHub sign-in failed. Try again.',
  'star-check':'Could not check your GitHub star. Please sign in again.',
};

export default function PixiPage({signedInEntry = false}) {
  const host = useRef(null);
  const page = useRef(null);
  const room = useRef(null);
  const island = useRef(null);
  const chatLayer = useRef(null);
  const chatEditor = useRef(null);
  const nameLayer = useRef(null);
  const [online, setOnline] = useState(null);
  const [travel,setTravel] = useState({islandId:'home',mode:'walking',available:3});
  const [travelNotice,setTravelNotice] = useState('');
  const [latestJoin, setLatestJoin] = useState(null);
  const [error, setError] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [status, setStatus] = useState('connecting');
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState('');
  const [arrival, setArrival] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [starDialogOpen, setStarDialogOpen] = useState(true);
  const [indoors,setIndoors] = useState(false);
  const [globeOpen,setGlobeOpen] = useState(false);
  const [notificationHost,setNotificationHost] = useState(null);
  const params = new URLSearchParams(location.search);
  const offline = params.has('offline') || (import.meta.env.DEV && params.get('dev') === '1');
  // back from GitHub: the intro's clouds cover the island until it is drawn, then a name tag, then the star box
  const [fromGitHub] = useState(arrivalPending);
  // guests and signed-in reloads come in under the same cover (a reload has no name tag)
  const [arriving] = useState(() => fromGitHub || !!window.EWArrival?.guest || signedInEntry);
  const [arrived, setArrived] = useState(() => !arriving);
  const [worldDrawn, setWorldDrawn] = useState(false);

  useEffect(() => {setTravelNotice('');},[travel.islandId,travel.mode]);
  useEffect(() => {
    if (!travelNotice) return;
    const timer=setTimeout(() => setTravelNotice(''),5000);
    return () => clearTimeout(timer);
  },[travelNotice]);
  useEffect(() => {document.getElementById('boot-sky')?.remove();}, []);   // the landing's first frame (index.html) is not part of the game
  useEffect(() => {if (session) rememberSignedIn(!!session.user);}, [session]);

  useEffect(() => {
    const abort = new AbortController();
    const refresh = async (initial = false) => {
      try {
        const value = initial ? await startupSession(true) : await fetch('/api/session', {signal:abort.signal}).then(r => {if (!r.ok) throw Error('Session request failed'); return r.json();});
        if (!abort.signal.aborted) setSession(value);
      } catch {
        if (!abort.signal.aborted) setSession({user:null, signInAvailable:false});
      }
    };
    const url = new URL(location.href);
    if (url.searchParams.has('auth')) {
      setNotice(authNotices[url.searchParams.get('auth')] ?? '');
      url.searchParams.delete('auth');
      history.replaceState(history.state, '', url);
    }
    let arrivalTimer, firstIsland = true;
    const client = new RoomClient(state => {
      setStatus(state);
      if (['connecting','reconnecting','expired','signed-out','spectators-full'].includes(state)) {
        island.current?.clearChat();
      }
      if (state === 'star-required') setStarDialogOpen(true);
      if (['expired','signed-out'].includes(state)) setSession(previous => previous && {...previous,user:null});
      if (['expired','signed-out','star-required'].includes(state)) refresh();
    }, (id,text) => island.current?.showChat(id,text), setOnline, setLatestJoin, state => {
      if (firstIsland && state.islandId === 'home') startHomeHeadStart({guest:true});
      firstIsland = false;
      settleHomeHeadStart(state.islandId);
      setTravel(state);
      void island.current?.prepareIsland(state.islandId).catch(()=>{});
    }, setTravelNotice);
    room.current = offline ? null : client;
    const game = new PixiIsland({room:offline ? null : client, chatLayer:chatLayer.current, chatEditor, nameLayer:nameLayer.current,
      randomArrival:offline, onArrival:name => {
        setArrival(`Landed in ${name}`);
        clearTimeout(arrivalTimer);
        arrivalTimer = setTimeout(() => setArrival(''), 4000);
        if (offline) setTravel({islandId:island.current.islandId,mode:'walking',available:0});
      },
      onError:() => setError(true), onInteriorChange:setIndoors, onGlobeChange:open => {
        setGlobeOpen(open);
        if (!offline) client.setGlobeOpen(open);
      }, onPhotoReady:()=>setCameraReady(true)});
    island.current = game;
    // the island's art is in once its canvas says ready (mount resolves earlier, while the art still streams in)
    const drawnPoll = setInterval(() => {if (host.current?.querySelector('canvas[data-state="ready"]')) {clearInterval(drawnPoll); finishHomeHeadStart(); requestAnimationFrame(() => setWorldDrawn(true));}}, 150);
    game.mount(host.current).catch(error=>{console.error('Could not initialize world',error);setError(true);});
    if (offline) {
      setStatus('local');
    } else {
      client.connect();
      refresh(true);
    }
    return () => {
      abort.abort();
      clearTimeout(arrivalTimer);
      clearInterval(drawnPoll);
      client.dispose();
      game.dispose();
      island.current = null;
      room.current = null;
    };
  }, []);

  // action prompts (Take boat, Dock, telescope) float above Ducky's head instead of sitting at the bottom
  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function') return;   // headless renders have no frames to follow
    let frame;
    const tick = () => {
      const game = island.current, pose = game?.player, el = page.current;
      if (game && pose && el && game.width) {
        const at = game.duckLabelPosition(pose);
        el.style.setProperty('--duck-x', `${Math.round(at.x)}px`);
        el.style.setProperty('--duck-y', `${Math.round(at.y)}px`);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  async function logout() {
    setSigningOut(true);
    setNotice('');
    try {
      const response = await fetch('/auth/logout', {method:'POST'});
      if (!response.ok) throw new Error('Sign out failed');
      setSession(previous => ({...previous,user:null}));
      room.current?.connect(false);
    } catch {
      setNotice('Could not sign out. Try again.');
    } finally {
      setSigningOut(false);
    }
  }

  const guest = !offline && session && !session.user && status !== 'playing';
  const retryLive = status === 'spectators-full';
  const starRequired = session?.user && !session.user.canPlay;
  const retryPlay = session?.user?.canPlay && ['players-full','taken-over','watching'].includes(status);
  // a visitor who cannot play yet only watches: no duck, so no profile circle
  const watchOnly = !offline && status !== 'playing' && (guest || starRequired);
  // waiting and problems take the middle of the screen with the golden feather (the same loader as the cloud
  // cover); passing information (watching, landed, star) stays small at the top right
  const waiting = status === 'connecting' || status === 'reconnecting';
  const connecting = signedInEntry && !error && !worldDrawn && (waiting || !CENTRE.has(status));
  const centre = !connecting && !error && !offline && arrived && CENTRE.has(status);
  return <>
  {connecting && !arriving && <IslandConnecting/>}
  <main ref={page} inert={connecting} className={`pixi-page${watchOnly ? ' pixi-page--watch' : ''}`}>
    <div className="pixi-host" ref={host}/>
    <img className="pixi-ente-logo" src="/ente-wordmark-white.svg" alt="Ente" width="844" height="264"/>
    {!error && <IslandMusic island={island}/>}
    <div className="pixi-chat-layer">
      <div ref={nameLayer}/>
      <div ref={chatLayer} aria-live="polite" aria-relevant="additions text"/>
    </div>
    {/* status and the odd action stay top right, but only when there is something to say; the profile button
        takes over outfit, friends and sign out */}
    {!error && (() => {
      const message = notice || arrival || (offline ? 'Playing without sign-in' : centre ? '' : notices[status])
        || (guest ? '' : starRequired ? notices['star-required'] : status === 'playing' ? '' : 'Watching live');
      const actions = offline || starRequired || (!centre && (retryLive || retryPlay));
      return (message || actions) && <aside className="pixi-live" aria-label="Live island">
        {message && <div role="status">{message}</div>}
        {offline && <a href={location.pathname}>Back to live</a>}
        {starRequired && <button onClick={() => setStarDialogOpen(true)}>Unlock play</button>}
        {retryLive && !centre && <button onClick={() => room.current?.connect(room.current.wantsPlay)}>Retry live view</button>}
        {retryPlay && !centre && <button onClick={() => room.current?.connect()}>
          {status === 'taken-over' ? 'Take control' : 'Join island'}
        </button>}
      </aside>;
    })()}
    {!error && guest && (session.signInAvailable
      ? <a className="pixi-guest-signin" href="/auth/github/start" onClick={() => {try {sessionStorage.setItem('ew-arrive', '1');} catch {/* ignore */}}}><img src="/github-mark.svg" width="24" height="24" alt=""/>Sign in</a>
      : <button type="button" className="pixi-guest-signin" disabled>Sign-in unavailable</button>)}
    {!error && !watchOnly && (session?.user || status === 'playing' || offline) && <IslandProfile session={session} room={room} island={island}
      status={status} indoors={indoors} notificationHost={notificationHost} offline={offline} onSignOut={logout} signingOut={signingOut}/>}
    {!error && status === 'playing' && <div className="pixi-chat-dock">
      <IslandChat key={`chat:${travel.islandId}`} room={room} island={island} editor={chatEditor}/>
    </div>}
    {!error && <div className="pixi-bottom-hud">
      <IslandTravel travel={travel} playing={status==='playing' || offline} room={room} island={island} notice={travelNotice}/>
      <IslandStargaze island={island} playing={status==='playing' || offline} offline={offline}/>
      <div className="pixi-notifications" ref={setNotificationHost}>
        <IslandPresence online={online} latestJoin={latestJoin}/>
      </div>
    </div>}
    {!error && <IslandCamera island={island} ready={cameraReady} player={session?.user?.login}/>}
    {!error && <WorldMap island={island} globeOpen={globeOpen} indoors={indoors}/>}
    {!error && <BogEntry engine={island} travel={travel} status={status} {...BOG_COMBAT}
      accountId={session?.user?.accountId}
      name={session?.user?.login??'Ducky'}
      onReturnToDock={()=>room.current?.returnToBoat()} onLeave={()=>room.current?.returnToBoat()}/>}
    {centre && <div className={`pixi-centre${waiting ? ' pixi-centre--wait' : ''}`} key={status}>
      <div className="pixi-centre-card" role={waiting ? 'status' : 'alertdialog'} aria-live="polite" aria-label={notices[status]}>
        {/* waiting: the feather with the words under it (their dots hop); a problem: the feather, then the message and its button */}
        <div className="arrival-loader" aria-hidden="true" dangerouslySetInnerHTML={{__html:window.EWArrival?.loader?.(waiting ? notices[status].replace(/…$/, '') : '') || ''}}/>
        {!waiting && <p>{notices[status]}</p>}
        {status === 'taken-over' && <button onClick={() => room.current?.connect()}>Take control</button>}
        {status === 'spectators-full' && <button onClick={() => room.current?.connect(room.current.wantsPlay)}>Try again</button>}
        {status === 'expired' && <a href="/auth/github/start" onClick={() => {try {sessionStorage.setItem('ew-arrive', '1');} catch {/* ignore */}}}>Sign in again</a>}
      </div>
    </div>}
    {arriving && <ArrivalClouds drawn={worldDrawn || error} login={fromGitHub ? session?.user?.login : null} message={!fromGitHub && !window.EWArrival?.guest ? 'Connecting to your island' : undefined} onDone={() => setArrived(true)}/>}
    {starRequired && starDialogOpen && arrived && !connecting && <StarDialog onClose={() => setStarDialogOpen(false)} onConfirm={() => {
      setSession(previous => ({...previous,user:{...previous.user,canPlay:true}}));
      setStarDialogOpen(false);
      room.current?.connect();
    }}/>}
    {error && <div className="pixi-error" role="alert">
      <p>The island could not be displayed.</p>
      <button onClick={() => location.reload()}>Try again</button>
    </div>}
  </main>
  </>;
}
