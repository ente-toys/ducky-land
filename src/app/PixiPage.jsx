import {useEffect, useRef, useState} from 'react';
import {PixiIsland} from '../rendering/pixi/engine.js';
import {RoomClient} from '../multiplayer/room-client.js';
import IslandChat from './IslandChat.jsx';
import IslandPresence from './IslandPresence.jsx';
import StarDialog from './StarDialog.jsx';
import IslandTravel from './IslandTravel.jsx';
import IslandStargaze from './IslandStargaze.jsx';
import IslandProfile from './IslandProfile.jsx';
import IslandCamera from './IslandCamera.jsx';
import WorldMap from './WorldMap.jsx';
import BogEntry from '../features/bog-combat/BogEntry.jsx';
import {BOG_COMBAT} from '../features/bog-combat/config.js';
import './pixi.css';

const notices = {
  connecting:'Connecting to the island…',
  reconnecting:'Reconnecting…',
  'spectators-full':'Live view is full.',
  'players-full':'There’s no room to join right now. You can still watch.',
  'taken-over':'Your duck is playing in another tab.',
  expired:'Your session expired.',
  'star-required':'Star ente/ente to play. You can still watch.',
};

const authNotices = {
  cancelled:'GitHub sign-in was cancelled.',
  failed:'GitHub sign-in failed. Try again.',
  'star-check':'Could not check your GitHub star. Please sign in again.',
};

const githubSignInLabel = <><img src="/github-mark.svg" width="18" height="18" alt=""/>Play with GitHub</>;

export default function PixiPage() {
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

  useEffect(() => {setTravelNotice('');},[travel.islandId,travel.mode]);

  useEffect(() => {
    const abort = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch('/api/session', {signal:abort.signal});
        if (!response.ok) throw new Error('Session request failed');
        setSession(await response.json());
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
    let arrivalTimer;
    const client = new RoomClient(state => {
      setStatus(state);
      if (['connecting','reconnecting','expired','signed-out','spectators-full'].includes(state)) {
        island.current?.clearChat();
      }
      if (state === 'star-required') setStarDialogOpen(true);
      if (['expired','signed-out'].includes(state)) setSession(previous => previous && {...previous,user:null});
      if (['expired','signed-out','star-required'].includes(state)) refresh();
    }, (id,text) => island.current?.showChat(id,text), setOnline, setLatestJoin, state => {
      setTravel(state);
    }, setTravelNotice);
    room.current = offline ? null : client;
    const game = new PixiIsland({room:offline ? null : client, chatLayer:chatLayer.current, chatEditor, nameLayer:nameLayer.current,
      randomArrival:offline, onArrival:name => {
        setArrival(`Landed in ${name}`);
        clearTimeout(arrivalTimer);
        arrivalTimer = setTimeout(() => setArrival(''), 4000);
        if (offline) setTravel({islandId:island.current.islandId,mode:'walking',available:0});
      },
      onError:() => setError(true),onInteriorChange:setIndoors,onGlobeChange:setGlobeOpen,onPhotoReady:()=>setCameraReady(true)});
    island.current = game;
    game.mount(host.current).catch(error=>{console.error('Could not initialize world',error);setError(true);});
    if (offline) {
      setStatus('local');
    } else {
      client.connect();
      refresh();
    }
    return () => {
      abort.abort();
      clearTimeout(arrivalTimer);
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
  return <main ref={page} className={`pixi-page${guest ? ' pixi-page--guest' : ''}`}>
    <div className="pixi-host" ref={host}/>
    <img className="pixi-ente-logo" src="/ente-wordmark-white.svg" alt="Ente" width="844" height="264"/>
    <div className="pixi-chat-layer">
      <div ref={nameLayer}/>
      <div ref={chatLayer} aria-live="polite" aria-relevant="additions text"/>
    </div>
    {/* status and the odd action stay top right, but only when there is something to say; the profile button
        takes over outfit, friends and sign out */}
    {!error && (() => {
      const message = notice || arrival || (offline ? 'Playing without sign-in' : notices[status]) || (status === 'playing' ? '' : 'Watching live');
      const actions = offline || starRequired || retryLive || retryPlay;
      return (message || actions) && <aside className="pixi-live" aria-label="Live island">
        {message && <div role="status">{message}</div>}
        {offline && <a href={location.pathname}>Back to live</a>}
        {starRequired && <button onClick={() => setStarDialogOpen(true)}>Unlock play</button>}
        {retryLive && <button onClick={() => room.current?.connect(room.current.wantsPlay)}>Retry live view</button>}
        {retryPlay && <button onClick={() => room.current?.connect()}>
          {status === 'taken-over' ? 'Take control' : 'Join island'}
        </button>}
      </aside>;
    })()}
    {!error && (session?.user || status === 'playing' || offline) && <IslandProfile session={session} room={room} island={island}
      status={status} indoors={indoors} notificationHost={notificationHost} offline={offline} onSignOut={logout} signingOut={signingOut}/>}
    {!error && status === 'playing' && <div className="pixi-chat-dock">
      <IslandChat key={`chat:${travel.islandId}`} room={room} island={island} editor={chatEditor}/>
    </div>}
    {!error && guest && <aside className="pixi-guest-play" aria-labelledby="pixi-guest-heading">
      <h2 id="pixi-guest-heading">Your duck is waiting</h2>
      <p>Explore on your own or sign in to play online.</p>
      {session.signInAvailable
        ? <a href="/auth/github/start">{githubSignInLabel} <span aria-hidden="true">→</span></a>
        : <><button disabled>{githubSignInLabel}</button><small>Sign-in is unavailable right now.</small></>}
      <a className="pixi-guest-offline" href="?offline">Continue as guest</a>
    </aside>}
    {!error && <div className="pixi-bottom-hud">
      <IslandTravel travel={travel} playing={status==='playing' || offline} room={room} island={island} notice={travelNotice}/>
      <IslandStargaze island={island} playing={status==='playing' || offline} offline={offline}/>
      <div className="pixi-notifications" ref={setNotificationHost}>
        <IslandPresence online={online} latestJoin={latestJoin}/>
      </div>
    </div>}
    {!error && <IslandCamera island={island} ready={cameraReady}/>}
    {!error && <WorldMap island={island} globeOpen={globeOpen} indoors={indoors}/>}
    {!error && <BogEntry engine={island} travel={travel} status={status} {...BOG_COMBAT}
      accountId={session?.user?.accountId}
      name={session?.user?.login??'Ducky'}
      onReturnToDock={()=>room.current?.returnToBoat()} onLeave={()=>room.current?.returnToBoat()}/>}
    {starRequired && starDialogOpen && <StarDialog onClose={() => setStarDialogOpen(false)} onConfirm={() => {
      setSession(previous => ({...previous,user:{...previous.user,canPlay:true}}));
      setStarDialogOpen(false);
      room.current?.connect();
    }}/>}
    {error && <div className="pixi-error" role="alert">
      <p>The island could not be displayed.</p>
      <button onClick={() => location.reload()}>Try again</button>
    </div>}
  </main>;
}
