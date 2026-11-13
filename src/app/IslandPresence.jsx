import {useEffect, useRef, useState} from 'react';

export default function IslandPresence({online, latestJoin}) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  function dismiss(id) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts(previous => previous.filter(toast => toast.id !== id));
  }

  useEffect(() => {
    if (!latestJoin) return;
    setToasts(previous => [...previous.filter(toast => toast.id !== latestJoin.id),latestJoin].slice(-3));
    clearTimeout(timers.current.get(latestJoin.id));
    timers.current.set(latestJoin.id,setTimeout(() => dismiss(latestJoin.id),5000));
  }, [latestJoin]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
  }, []);

  return <>
    <div className="pixi-online" aria-label="Live users">
      <span className="pixi-online-dot" aria-hidden="true"/>
      {online === null ? 'Connecting…' : `${online} ${online === 1 ? 'user' : 'users'} online`}
    </div>
    <div className="pixi-join-toasts" role="status" aria-live="polite" aria-relevant="additions">
      {toasts.map(toast => <div className="pixi-join-toast" key={toast.id}>
        <span>{toast.login ? `@${toast.login}` : 'A player'} joined the island</span>
        <button type="button" aria-label="Dismiss join notification" onClick={() => dismiss(toast.id)}>×</button>
      </div>)}
    </div>
  </>;
}
