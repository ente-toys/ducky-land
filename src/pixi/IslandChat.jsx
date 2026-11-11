import {useEffect, useLayoutEffect, useState} from 'react';
import {CHAT_LIMIT} from './chat.js';
import IslandHudIcon from './IslandHudIcon.jsx';

export default function IslandChat({room, island, editor}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  useLayoutEffect(() => {
    if (!open) return;
    island.current?.positionChatEditor();
    editor.current?.focus({preventScroll:true});
  }, [open, editor, island]);

  useEffect(() => {
    function shortcut(event) {
      if (event.defaultPrevented || event.repeat || event.isComposing ||
          event.metaKey || event.ctrlKey || event.altKey || event.key.toLowerCase() !== 'c' ||
          event.target?.isContentEditable || event.target?.matches?.('input, textarea, select')) return;
      event.preventDefault();
      island.current?.stopInput();
      setOpen(true);
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [island]);

  function close(clear = false) {
    if (clear) room.current?.chat('');
    setDraft('');
    setOpen(false);
    island.current?.canvas?.focus({preventScroll:true});
  }

  if (!open) return <button className="pixi-hud-tool" type="button" aria-label="Chat" aria-keyshortcuts="C" title="Chat (C)" onClick={() => {
    island.current?.stopInput();
    setOpen(true);
  }}><IslandHudIcon name="chat"/><span className="pixi-tool-label">Chat</span></button>;

  return <form className="pixi-chat" aria-label="Island chat" onSubmit={event => {
    event.preventDefault();
    close();
  }} onKeyDown={event => {
    if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      close(true);
    }
  }}>
    <input ref={editor} aria-label="Message" placeholder="Say something…" autoComplete="off"
      aria-description="Visible as you type. Escape clears." enterKeyHint="done"
      style={{'--chat-size':`${Math.min(28, Math.max(14, Array.from(draft).length + 2))}ch`}}
      maxLength={CHAT_LIMIT} value={draft} onChange={event => {
        const value = event.target.value;
        setDraft(value);
        room.current?.chat(value);
      }}/>
    <button type="submit" aria-label="Done">✓</button>
  </form>;
}
