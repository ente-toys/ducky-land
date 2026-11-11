import {useEffect, useRef, useState} from 'react';
import {PixiIsland} from './engine.js';
import {RoomClient} from './room-client.js';
import IslandChat from './IslandChat.jsx';
import IslandPresence from './IslandPresence.jsx';
import StarDialog from './StarDialog.jsx';
import IslandTravel from './IslandTravel.jsx';
import IslandFriends from './IslandFriends.jsx';
import WorldMap from './WorldMap.jsx';
import IslandOutfit from './IslandOutfit.jsx';
import IslandHudIcon from './IslandHudIcon.jsx';
import BogEntry from './bog-combat/BogEntry.jsx';
import {BOG_COMBAT} from './bog-combat/config.js';
import './pixi.css';

const notices = {
  'spectators-full':'Live view is full.',
  'players-full':'The island is full. You can still watch.',
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
  const [signingOut, setSigningOut] = useState(false);
  const [starDialogOpen, setStarDialogOpen] = useState(true);
  const [indoors,setIndoors] = useState(false);
  const [notificationHost,setNotificationHost] = useState(null);
  const offline = import.meta.env.DEV && new URLSearchParams(location.search).has('offline');

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
    // dev only: ?offline plays the island locally with no room server (for design review); absent = unchanged
    room.current = offline ? null : client;
    const game = new PixiIsland({room:offline ? null : client, chatLayer:chatLayer.current, chatEditor, nameLayer:nameLayer.current,
      externalOverview:true,transparent:true,renderResolution:1,onError:() => setError(true),onInteriorChange:setIndoors});
    island.current = game;
    let earth=null,cancelled=false;
    game.mount(host.current).then(async()=>{
      if(cancelled||!game.ready)return;
      const {createThreeGameView}=await import('./three-game-view.js');
      if(cancelled)return;
      earth=await createThreeGameView(game,host.current);
      if(import.meta.env.DEV&&new URLSearchParams(location.search).has('pirates')){const {piratePreview}=await import('../../scripts/pirate-ships/preview.js');await piratePreview(game);}
      if(cancelled)earth?.destroy();
    }).catch(error=>{console.error('Could not initialize world',error);setError(true);});
    client.connect();
    refresh();
    return () => {
      cancelled=true;earth?.destroy();
      abort.abort();
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
  const playing = status === 'playing';
  const signedIn = Boolean(session?.user || playing);
  const connected = playing || ['watching','players-full','taken-over','star-required'].includes(status);
  const modeLabel = offline ? 'Offline' : playing ? 'Playing' : connected ? 'Watching' :
    status === 'connecting' ? 'Connecting…' : status === 'reconnecting' ? 'Reconnecting…' : 'Disconnected';
  const message = notice || notices[status];
  return <main className="pixi-page">
    <div className="pixi-host" ref={host}/>
    <div className="pixi-chat-layer">
      <div ref={nameLayer}/>
      <div ref={chatLayer} aria-live="polite" aria-relevant="additions text"/>
    </div>
    {!error && <header className="pixi-live" aria-label="Ducky Land controls">
      <div className="pixi-hud-identity">
        <img className="pixi-ente-logo" src="/ente-wordmark-white.svg" alt="Ente" width="844" height="264"/>
        <div className="pixi-hud-presence">
          <span className="pixi-hud-mode" role="status">
            <span className="pixi-online-dot" data-connected={!offline && connected} aria-hidden="true"/>
            {modeLabel}
          </span>
          {!offline && connected && online !== null && <span className="pixi-hud-count">{online} online</span>}
        </div>
      </div>
      {(signedIn || offline) && <div className="pixi-hud-tools" role="group" aria-label="Game actions">
        {playing && <IslandChat key={`chat:${travel.islandId}`} room={room} island={island} editor={chatEditor}/>}
        {(playing || offline) && <IslandOutfit key={`outfit:${session?.user?.accountId ?? 'local'}`} island={island} offline={offline}/>}
        {session?.user && <IslandFriends key={`friends:${session.user.accountId}`} room={room} island={island}
          status={status} indoors={indoors} notificationHost={notificationHost}/>}
        {signedIn && <>
          <button type="button" className="pixi-hud-tool" aria-label="Account options" popoverTarget="pixi-account">
            <IslandHudIcon name="menu"/>
          </button>
          <div id="pixi-account" className="pixi-account" popover="auto">
            {session?.user?.login && <p>@{session.user.login}</p>}
            <button type="button" onClick={logout} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
          </div>
        </>}
      </div>}
      {(message || starRequired || retryLive || retryPlay) && <div className="pixi-hud-notice">
        {message && <span role="status">{message}</span>}
        {starRequired && <button type="button" onClick={() => setStarDialogOpen(true)}>Unlock play</button>}
        {retryLive && <button type="button" onClick={() => room.current?.connect(room.current.wantsPlay)}>Retry live view</button>}
        {retryPlay && <button type="button" onClick={() => room.current?.connect()}>
          {status === 'taken-over' ? 'Take control' : 'Join island'}
        </button>}
      </div>}
    </header>}
    {!error && <>
      <IslandTravel travel={travel} playing={status==='playing'} room={room} island={island} notice={travelNotice}/>
      <div className="pixi-bottom-center">
        <div className="pixi-notifications" ref={setNotificationHost}>
          <IslandPresence latestJoin={latestJoin}/>
        </div>
        {guest && <div className="pixi-guest-slot">
          <aside className="pixi-guest-play" aria-labelledby="pixi-guest-heading">
            <h2 id="pixi-guest-heading">Your duck is waiting</h2>
            <p>Sign in to walk, quack, and explore.</p>
            {session.signInAvailable
              ? <a href="/auth/github/start">Play with GitHub <span aria-hidden="true">→</span></a>
              : <><button disabled>Play with GitHub</button><small>Sign-in is unavailable right now.</small></>}
          </aside>
        </div>}
      </div>
    </>}
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
