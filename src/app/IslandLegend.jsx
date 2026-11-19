import {useEffect, useRef, useState} from 'react';
import {TELEPORT_COST, TELEPORTER_MAP_ICON} from '../gameplay/teleport.js';

const discoveries = [
  {icon:'🔭', title:'Telescope', hint:'See who is online', text:'Walk up to a telescope and choose “Look through the telescope”. The stars represent Ente stargazers. Hover or tap a star to see their name and online status. Drag to look around the sky.'},
  {icon:'🪶', title:'Feathers & the bog', hint:'Collect 5 to join a paint fight', text:'Walk over golden feathers scattered across the islands to collect them. Each entry to Booquack Bog costs 5 feathers. Sail toward the paint-gun badge on the minimap, dock, and pick a team to shoot other players.', extra:'In the bog: move with WASD or arrows, hold Space to shoot forward, or use J or left click. You get five lives per entry. Your medals and lifetime progress carry over.'},
  {icon:'⛵', title:'Beyond the shore', hint:'Take a boat to another island', text:'Tap a boat to board, or walk near one and choose “Take boat”. Steer with WASD or arrows, or tap the water. Near a shore, choose “Dock”. The minimap shows nearby islands and the direction you are facing.'},
  {icon:<img src={TELEPORTER_MAP_ICON} alt="" width="25" height="25"/>, title:'Harbor teleporters', hint:'Find the green portal pins on the map', text:`Walk up to a harbor teleporter to choose a destination. The portal turns blue when you have the ${TELEPORT_COST} golden feathers needed for a trip. Booquack Bog also charges its entry fee.`},
  {icon:'💬', title:'Meet & make it yours', hint:'Chat, quack, dress up', text:'Use Chat to talk with players on your island. Walk near someone to send a friend request, and open Friends to accept requests. Open Outfit to change your hat, glasses, and shoes.', extra:'Tap your duck to quack; tap twice to dance. On a keyboard: Q quacks, E dances, 1–7 emote, and Space jumps. Move with WASD or arrows, hold Shift to run, or tap where you want to walk.'},
  {icon:'✨', title:'Little discoveries', hint:'A few things reward a closer look', text:'Walk up the museum steps on the home island to explore inside; walk out through the arch to leave. Tap a sleeping duck for a sleepy wobble. Try the benches on Bellovo and the ice rink on Iceland.', extra:'Scroll or pinch to explore the world at different scales. Press F to return the camera to your duck. Press M to toggle sound.'},
];

export default function IslandLegend({island}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    island.current?.stopInput();
    element.showModal();
    return () => element.close();
  }, [open, island]);

  return <>
    <button className="pixi-legend-trigger" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
      aria-label="Island guide" title="Island guide"><span aria-hidden="true">i</span></button>
    {open && <dialog ref={dialog} className="pixi-legend" aria-labelledby="island-guide-title"
      onClose={event => {if (!event.currentTarget.open) setOpen(false);}}
      onKeyDown={event => event.stopPropagation()}>
      <header>
        <div><small>A LITTLE FIELD GUIDE</small><h2 id="island-guide-title">There’s more to this island.</h2></div>
        <button type="button" aria-label="Close island guide" onClick={() => setOpen(false)}>×</button>
      </header>
      <p className="pixi-legend-intro">A few things to try. Explore at your own pace.</p>
      <div className="pixi-legend-entries">
        {discoveries.map(({icon, title, hint, text, extra}) => <details key={title} name="island-discoveries">
          <summary><span className="pixi-legend-icon" aria-hidden="true">{icon}</span><span><strong>{title}</strong><span>{hint}</span></span></summary>
          <p>{text}</p>{extra && <p>{extra}</p>}
        </details>)}
      </div>
      <p className="pixi-legend-footer">Always here when you need a hint.</p>
    </dialog>}
  </>;
}
