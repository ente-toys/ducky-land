import {useEffect, useRef, useState} from 'react';
import {PixiIsland} from './engine.js';
import './pixi.css';

export default function PixiPage() {
  const host = useRef(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Ducky Land · Illustrated island';
    const island = new PixiIsland({onError: () => setError(true)});
    island.mount(host.current);
    return () => { island.dispose(); document.title = previousTitle; };
  }, []);
  return <main className="pixi-page">
    <div className="pixi-host" ref={host}/>
    {error && <div className="pixi-error" role="alert">
      <p>The island could not be displayed.</p>
      <button onClick={() => location.reload()}>Try again</button>
      <a href="/three/">Open the 3D island</a>
    </div>}
  </main>;
}
