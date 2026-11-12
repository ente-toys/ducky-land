import {useEffect, useRef, useState} from 'react';
import {PixiIsland} from '../rendering/pixi/engine.js';
import {RoomClient} from '../multiplayer/room-client.js';
import IslandChat from './IslandChat.jsx';
import IslandPresence from './IslandPresence.jsx';
import StarDialog from './StarDialog.jsx';
import IslandTravel from './IslandTravel.jsx';
import IslandStargaze from './IslandStargaze.jsx';
import IslandFriends from './IslandFriends.jsx';
import WorldMap from './WorldMap.jsx';
import IslandOutfit from './IslandOutfit.jsx';
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

export default function PixiPage() {
  const host = useRef(null);
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
  const [status, setStatus] = useState('connecting');
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState('');
  const [arrival, setArrival] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [starDialogOpen, setStarDialogOpen] = useState(true);
  const [indoors,setIndoors] = useState(false);
  const [notificationHost,setNotificationHost] = useState(null);
  const params = new URLSearchParams(location.search);
  const offline = import.meta.env.DEV && (params.get('dev') === '1' || params.has('offline'));

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
      externalOverview:true,transparent:true,renderResolution:1,onError:() => setError(true),onInteriorChange:setIndoors});
    island.current = game;
    let earth=null,cancelled=false;
    game.mount(host.current).then(async()=>{
      if(cancelled||!game.ready)return;
      const {createThreeGameView}=await import('../rendering/three/three-game-view.js');
      if(cancelled)return;
      earth=await createThreeGameView(game,host.current);
      if(cancelled)earth?.destroy();
    }).catch(error=>{console.error('Could not initialize world',error);setError(true);});
    if (offline) {
      setStatus('local');
    } else {
      client.connect();
      refresh();
    }
    return () => {
      cancelled=true;earth?.destroy();
      abort.abort();
      clearTimeout(arrivalTimer);
      client.dispose();
      game.dispose();
      island.current = null;
      room.current = null;
    };
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
  return <main className={`pixi-page${guest ? ' pixi-page--guest' : ''}`}>
    <div className="pixi-host" ref={host}/>
    <img className="pixi-ente-logo" src="/ente-wordmark-white.svg" alt="Ente" width="844" height="264"/>
    <div className="pixi-chat-layer">
      <div ref={nameLayer}/>
      <div ref={chatLayer} aria-live="polite" aria-relevant="additions text"/>
    </div>
    {!error && <aside className="pixi-live" aria-label="Live island">
      <div role="status">{notice || arrival || (offline ? 'Local development · Playing without sign-in' : notices[status]) || (status === 'playing' ? 'You’re playing' : 'Watching live')}</div>
      {status === 'playing' && <IslandChat key={`chat:${travel.islandId}`} room={room} island={island} editor={chatEditor}/>}
      {(status === 'playing' || offline) && <IslandOutfit key={`outfit:${session?.user?.accountId ?? 'local'}`} island={island} offline={offline}/>}
      {session?.user && <IslandFriends key={`friends:${session.user.accountId}`} room={room} island={island}
        status={status} indoors={indoors} notificationHost={notificationHost}/>}
      {starRequired && <button onClick={() => setStarDialogOpen(true)}>Unlock play</button>}
      {retryLive && <button onClick={() => room.current?.connect(room.current.wantsPlay)}>Retry live view</button>}
      {retryPlay && <button onClick={() => room.current?.connect()}>
        {status === 'taken-over' ? 'Take control' : 'Join island'}
      </button>}
      {(session?.user || status === 'playing') && <button onClick={logout} disabled={signingOut}>Sign out</button>}
    </aside>}
    {!error && guest && <aside className="pixi-guest-play" aria-labelledby="pixi-guest-heading">
      <h2 id="pixi-guest-heading">Your duck is waiting</h2>
      <p>Sign in to walk, quack, and explore.</p>
      {session.signInAvailable
        ? <a href="/auth/github/start">Play with GitHub <span aria-hidden="true">→</span></a>
        : <><button disabled>Play with GitHub</button><small>Sign-in is unavailable right now.</small></>}
    </aside>}
    {!error && <div className="pixi-bottom-hud">
      <IslandTravel travel={travel} playing={status==='playing' || offline} room={room} island={island} notice={travelNotice}/>
      <IslandStargaze island={island} playing={status==='playing' || offline} offline={offline}/>
      <div className="pixi-notifications" ref={setNotificationHost}>
        <IslandPresence online={online} latestJoin={latestJoin}/>
      </div>
    </div>}
    {!error && <WorldMap island={island}/>}
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
