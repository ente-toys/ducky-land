import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import IslandFriends from './IslandFriends.jsx';
import {OutfitEditor} from './IslandOutfit.jsx';
import {useDuckPortrait} from './DuckPortrait.js';
import {sameOutfit} from '../rendering/pixi/duck-portrait.js';
import IslandFeathers from './IslandFeathers.jsx';

// One profile button in place of the old row (Change outfit, Friends, Sign out). It opens a panel with the
// player's duck (the edit button opens the outfit editor), their GitHub name, their friends, and Sign out.
export default function IslandProfile({session, room, island, status, indoors, notificationHost, offline, onSignOut, signingOut}) {
  const [open, setOpen] = useState(false);
  const [outfit, setOutfit] = useState(null);
  const [editing, setEditing] = useState(null);
  const [requests, setRequests] = useState(0);
  const panel = useRef(null);
  const user = session?.user;
  const portrait = useDuckPortrait(outfit);

  // the player's outfit arrives with their duck; keep watching so a save from anywhere shows up here
  useEffect(() => {
    const id = setInterval(() => {
      if (!island.current?.ready) return;
      const current = island.current.player?.outfit;
      if (current) setOutfit(previous => sameOutfit(current,previous) ? previous : {...current});
    }, 500);
    return () => clearInterval(id);
  }, [island]);

  useEffect(() => {
    if (!open) return;
    const close = event => {if (!panel.current?.contains(event.target) && !event.target.closest?.('.pixi-outfit-dialog')) setOpen(false);};
    const key = event => {if (event.key === 'Escape') setOpen(false);};
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    return () => {window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', key);};
  }, [open]);

  function edit(slot = 'cap') {
    const current = island.current?.player?.outfit;
    if (!current) return;
    island.current?.stopInput();
    setEditing({initial:{...current}, slot});
  }

  const playing = status === 'playing' || offline;
  return <div className="pixi-profile" ref={panel}>
    <button type="button" className="pixi-profile-button" aria-expanded={open} aria-controls="pixi-profile-panel"
      aria-label={`Profile${requests ? `, ${requests} friend request${requests > 1 ? 's' : ''}` : ''}`} onClick={() => setOpen(value => !value)}>
      {portrait ? <img src={portrait} alt="" draggable="false"/> : <span className="pixi-profile-blank" aria-hidden="true"/>}
      {requests > 0 && <span className="pixi-profile-badge" aria-hidden="true">{requests}</span>}
    </button>
    <section id="pixi-profile-panel" className="pixi-profile-panel" hidden={!open} aria-label="Your profile">
      <div className="pixi-profile-head">
        <div className="pixi-profile-avatar">
          {portrait ? <img src={portrait} alt="Your duck" draggable="false"/> : <span className="pixi-profile-blank" aria-hidden="true"/>}
          {playing && <button type="button" className="pixi-profile-edit" aria-label="Change outfit" onClick={() => edit()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.2 4.8a2.2 2.2 0 0 1 3.1 0l.9.9a2.2 2.2 0 0 1 0 3.1L9 19l-4.5 1 1-4.5L15.2 4.8Z"/><path d="m13.5 6.5 4 4"/></svg>
          </button>}
        </div>
        <p className="pixi-profile-name">{user ? `@${user.login}` : 'Guest duck'}</p>
      </div>
      {user && <div className="pixi-profile-friends">
        <h3>Friends{requests ? <span className="pixi-profile-count">{requests}</span> : null}</h3>
        <IslandFriends key={`friends:${user.accountId}`} room={room} status={status} indoors={indoors}
          notificationHost={notificationHost} visible={open} onRequests={setRequests}/>
      </div>}
      {user && <button type="button" className="pixi-profile-signout" onClick={onSignOut} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>}
    </section>
    <IslandFeathers island={island}/>
    {editing && createPortal(<OutfitEditor initial={editing.initial} initialTab={editing.slot} island={island} offline={offline}
      onSaved={next => setOutfit({...next})} onClose={() => setEditing(null)}/>, document.body)}
  </div>;
}
