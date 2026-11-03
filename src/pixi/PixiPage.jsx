import {useEffect, useRef, useState} from 'react';
import {PixiIsland} from './engine.js';
import {RoomClient} from './room-client.js';
import IslandChat from './IslandChat.jsx';
import './pixi.css';

const notices = {
  connecting:'Connecting to the island…',
  reconnecting:'Reconnecting…',
  'spectators-full':'Live view is full.',
  'players-full':'The island is full. You can still watch.',
  'taken-over':'Your duck is playing in another tab.',
  expired:'Your session expired.',
};

const authNotices = {
  cancelled:'GitHub sign-in was cancelled.',
  failed:'GitHub sign-in failed. Try again.',
};

export default function PixiPage() {
  const host = useRef(null);
  const room = useRef(null);
  const island = useRef(null);
  const chatLayer = useRef(null);
  const chatEditor = useRef(null);
  const nameLayer = useRef(null);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState('connecting');
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState('');
  const [signingOut, setSigningOut] = useState(false);

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
      if (state === 'expired' || state === 'signed-out') refresh();
    }, (id,text) => island.current?.showChat(id,text));
    room.current = client;
    const game = new PixiIsland({room:client, chatLayer:chatLayer.current, chatEditor, nameLayer:nameLayer.current,
      onError:() => setError(true)});
    island.current = game;
    game.mount(host.current);
    client.connect();
    refresh();
    return () => {
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

  const retryLive = status === 'spectators-full';
  const retryPlay = session?.user && ['players-full','taken-over','watching'].includes(status);
  return <main className="pixi-page">
    <div className="pixi-host" ref={host}/>
    <div className="pixi-chat-layer">
      <div ref={nameLayer}/>
      <div ref={chatLayer} aria-live="polite" aria-relevant="additions text"/>
    </div>
    {!error && <aside className="pixi-live" aria-label="Live island">
      <div role="status">{notice || notices[status] || (status === 'playing' ? 'You’re playing' : 'Watching live')}</div>
      {status === 'playing' && <IslandChat room={room} island={island} editor={chatEditor}/>}
      {retryLive && <button onClick={() => room.current?.connect(room.current.wantsPlay)}>Retry live view</button>}
      {retryPlay && <button onClick={() => room.current?.connect()}>
        {status === 'taken-over' ? 'Take control' : 'Join island'}
      </button>}
      {session?.user || status === 'playing'
        ? <button onClick={logout} disabled={signingOut}>Sign out</button>
        : session?.signInAvailable
          ? <a href="/auth/github/start">Play with GitHub</a>
          : <button disabled title="GitHub sign-in is unavailable">Play with GitHub</button>}
    </aside>}
    {error && <div className="pixi-error" role="alert">
      <p>The island could not be displayed.</p>
      <button onClick={() => location.reload()}>Try again</button>
    </div>}
  </main>;
}
