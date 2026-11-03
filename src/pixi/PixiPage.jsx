import {useEffect, useRef, useState} from 'react';
import {PixiIsland} from './engine.js';
import {RoomClient} from './room-client.js';
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
      if (state === 'expired' || state === 'signed-out') refresh();
    });
    room.current = client;
    const island = new PixiIsland({room:client, onError:() => setError(true)});
    island.mount(host.current);
    client.connect();
    refresh();
    return () => {
      abort.abort();
      client.dispose();
      island.dispose();
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
    {!error && <aside className="pixi-live" aria-label="Live island">
      <div role="status">{notice || notices[status] || (status === 'playing' ? 'You’re playing' : 'Watching live')}</div>
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
