import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

export default function IslandFriends({room, island, status, indoors, notificationHost}) {
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
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

  function applyState(result) {
    const friends = result.friends ?? [], incoming = result.incoming ?? [], outgoing = result.outgoing ?? [];
    setFriends(friends); setIncoming(incoming); setOutgoing(outgoing);
    // Pending connections also suppress the nearby invitation prompt.
    room.current?.setFriends([...friends, ...incoming, ...outgoing]);
  }

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
        applyState(result);
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

  async function change(method, target, action) {
    if (pending || !requests.current || requests.current.signal.aborted) return;
    const lifetime = requests.current;
    setPending(target.accountId);
    setActionError('');
    setFeedback(null);
    try {
      const response = await fetch('/api/friends',{
        method, headers:{'Content-Type':'application/json'}, signal:lifetime.signal,
        body:JSON.stringify(method === 'POST' ? {playerId:target.id} : {accountId:target.accountId,...(action ? {action} : {})}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update friends. Try again.');
      if (lifetime.signal.aborted) return;
      room.current?.dismissFriend(target.accountId);
      applyState(result);
      refresh.current();
      if (method === 'POST' || action === 'accept') {
        const accepted = result.friends?.some(friend => friend.accountId === target.accountId);
        setFeedback({text:accepted ? `You and @${target.login} are now friends.` : `Friend request sent to @${target.login}.`,error:false});
      }
    } catch (error) {
      if (lifetime.signal.aborted) return;
      const message = error.message || 'Could not update friends. Try again.';
      if (method === 'POST') setFeedback({text:message,error:true});
      else setActionError(message);
    } finally {
      if (!lifetime.signal.aborted) setPending(null);
    }
  }

  const request = incoming[0];
  const showPrompt = !open && !loading && !loadError && (request || status === 'playing' && !indoors);
  return <>
    <button type="button" onClick={() => {setOpen(true); refresh.current();}}>Friends{incoming.length ? ` (${incoming.length})` : ''}</button>
    {open && <dialog ref={dialog} className="pixi-friends-dialog" aria-labelledby="friends-title"
      onClose={() => setOpen(false)} onCancel={() => setOpen(false)} onKeyDown={event => event.stopPropagation()}>
      <div className="pixi-friends-heading">
        <h2 id="friends-title">Your friends</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close friends">×</button>
      </div>
      <p>Walk near someone to send a friend request.</p>
      {loading && <p role="status">Loading friends…</p>}
      {loadError && <div role="alert"><p>{loadError}</p><button type="button" onClick={() => refresh.current()}>Try again</button></div>}
      {actionError && <p role="alert">{actionError}</p>}
      {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
      {!loading && !loadError && incoming.length > 0 && <section aria-label="Friend requests">
        <h3>Friend requests</h3>
        <ul className="pixi-friends-list">{incoming.map(request => <li key={request.accountId}>
          <span>@{request.login}</span>
          <div className="pixi-friend-actions">
            <button type="button" disabled={pending !== null} onClick={() => change('PATCH',request,'accept')}>Accept</button>
            <button type="button" disabled={pending !== null} onClick={() => change('PATCH',request,'decline')}>Decline</button>
          </div>
        </li>)}</ul>
      </section>}
      {!loading && !loadError && outgoing.length > 0 && <section aria-label="Sent requests">
        <h3>Sent requests</h3>
        <ul className="pixi-friends-list">{outgoing.map(request => <li key={request.accountId}>
          <span>@{request.login}</span>
          <button type="button" disabled={pending !== null} onClick={() => change('PATCH',request,'cancel')}>Cancel</button>
        </li>)}</ul>
      </section>}
      {!loading && !loadError && (friends.length ? <ul className="pixi-friends-list">
        {friends.map(friend => <li key={friend.accountId}>
          <span>@{friend.login}</span>
          <button type="button" disabled={pending !== null} aria-label={`Remove @${friend.login}`}
            onClick={() => change('DELETE',friend)}>{pending === friend.accountId ? 'Removing…' : 'Remove'}</button>
        </li>)}
      </ul> : <p className="pixi-friends-empty">No friends yet. Your next friend could be a few waddles away.</p>)}
    </dialog>}
    {notificationHost && showPrompt && (request || candidate || feedback) && createPortal(
      <aside className="pixi-friend-prompt" aria-label={request ? "Friend request" : "Nearby friend"}>
        {actionError && <p role="alert">{actionError}</p>}
        {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
        {request ? <p role="status"><strong>@{request.login}</strong> sent you a friend request.</p> :
          candidate && <p role="status">Send <strong>@{candidate.login}</strong> a friend request?</p>}
        <div className="pixi-friend-actions">
          {request && <>
            <button type="button" disabled={pending !== null} onClick={() => change('PATCH',request,'accept')}>Accept</button>
            <button type="button" disabled={pending !== null} onClick={() => change('PATCH',request,'decline')}>Decline</button>
          </>}
          {!request && candidate && <button type="button" disabled={pending !== null} onClick={() => change('POST',candidate)}>
            {pending === candidate.accountId ? 'Sending…' : 'Send request'}
          </button>}
          {!request && <button type="button" disabled={pending !== null} onClick={() => {
            room.current?.dismissFriend(candidate?.accountId);
            setFeedback(null);
          }}>Dismiss</button>}
        </div>
      </aside>,notificationHost)}
  </>;
}
