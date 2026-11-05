import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

export default function IslandFriends({room, island, status, indoors, notificationHost}) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  const requests = useRef(null);
  const refresh = useRef(() => {});

  useEffect(() => {
    const client = room.current;
    if (!client) return;
    const lifetime = new AbortController();
    requests.current = lifetime;
    let read;
    async function load() {
      read?.abort();
      const current = read = new AbortController();
      setLoading(true);
      setLoadError('');
      client.setFriends(null);
      try {
        const response = await fetch('/api/friends',{signal:current.signal});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load friends. Try again.');
        if (current.signal.aborted || lifetime.signal.aborted) return;
        setFriends(result.friends);
        client.setFriends(result.friends);
      } catch (error) {
        if (!current.signal.aborted && !lifetime.signal.aborted) setLoadError(error.message || 'Could not load friends. Try again.');
      } finally {
        if (!current.signal.aborted && !lifetime.signal.aborted) setLoading(false);
      }
    }
    refresh.current = load;
    client.onNearby = setCandidate;
    client.onFriendsChanged = load;
    load();
    return () => {
      lifetime.abort();
      read?.abort();
      refresh.current = () => {};
      client.onNearby = () => {};
      client.onFriendsChanged = () => {};
      client.clearFriends();
    };
  }, [room]);

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    island.current?.stopInput();
    element.showModal();
    return () => element.close();
  }, [open, island]);

  async function change(method, target) {
    if (pending || !requests.current || requests.current.signal.aborted) return;
    const lifetime = requests.current;
    setPending(target.accountId);
    setActionError('');
    setFeedback(null);
    try {
      const response = await fetch('/api/friends',{
        method, headers:{'Content-Type':'application/json'}, signal:lifetime.signal,
        body:JSON.stringify(method === 'POST' ? {playerId:target.id} : {accountId:target.accountId}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update friends. Try again.');
      if (lifetime.signal.aborted) return;
      room.current?.dismissFriend(target.accountId);
      if (method === 'POST') setFeedback({text:`@${result.friend.login} added to friends.`,error:false});
      refresh.current();
    } catch (error) {
      if (lifetime.signal.aborted) return;
      const message = error.message || 'Could not update friends. Try again.';
      if (method === 'POST') setFeedback({text:message,error:true});
      else setActionError(message);
    } finally {
      if (!lifetime.signal.aborted) setPending(null);
    }
  }

  const showPrompt = status === 'playing' && !indoors && !open && !loading && !loadError;
  return <>
    <button type="button" onClick={() => {setOpen(true); refresh.current();}}>Friends</button>
    {open && <dialog ref={dialog} className="pixi-friends-dialog" aria-labelledby="friends-title"
      onClose={() => setOpen(false)} onCancel={() => setOpen(false)} onKeyDown={event => event.stopPropagation()}>
      <div className="pixi-friends-heading">
        <h2 id="friends-title">Your friends</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close friends">×</button>
      </div>
      <p>Duckies you’ve saved. Walk near someone to add them.</p>
      {loading && <p role="status">Loading friends…</p>}
      {loadError && <div role="alert"><p>{loadError}</p><button type="button" onClick={() => refresh.current()}>Try again</button></div>}
      {actionError && <p role="alert">{actionError}</p>}
      {!loading && !loadError && (friends.length ? <ul className="pixi-friends-list">
        {friends.map(friend => <li key={friend.accountId}>
          <span>@{friend.login}</span>
          <button type="button" disabled={pending !== null} aria-label={`Remove @${friend.login}`}
            onClick={() => change('DELETE',friend)}>{pending === friend.accountId ? 'Removing…' : 'Remove'}</button>
        </li>)}
      </ul> : <p className="pixi-friends-empty">No friends yet. Your next friend could be a few waddles away.</p>)}
    </dialog>}
    {notificationHost && showPrompt && (candidate || feedback) && createPortal(
      <aside className="pixi-friend-prompt" aria-label="Nearby friend">
        {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
        {candidate && <p role="status">Add <strong>@{candidate.login}</strong> as a friend?</p>}
        <div className="pixi-friend-actions">
          {candidate && <button type="button" disabled={pending !== null} onClick={() => change('POST',candidate)}>
            {pending === candidate.accountId ? 'Adding…' : 'Add friend'}
          </button>}
          <button type="button" disabled={pending !== null} onClick={() => {
            room.current?.dismissFriend(candidate?.accountId);
            setFeedback(null);
          }}>Dismiss</button>
        </div>
      </aside>,notificationHost)}
  </>;
}
