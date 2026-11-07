import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Application} from 'pixi.js';
import {createDuck} from './duck.js';
import {randomOutfit, sameOutfit} from './outfits.js';

function OutfitPreview({outfit, onBusy, onError}) {
  const host = useRef(null);
  const rig = useRef(null);
  const initial = useRef(outfit);

  useEffect(() => {
    const app = new Application();
    let disposed = false, initialized = false, duck;
    onBusy(true);
    async function mount() {
      try {
        await app.init({width:360, height:300, backgroundAlpha:0, antialias:true,
          resolution:Math.min(devicePixelRatio || 1,2), autoDensity:true, preference:'webgl'});
        initialized = true;
        if (disposed) {app.destroy({removeView:true,releaseGlobalResources:false},{children:true}); return;}
        app.canvas.setAttribute('aria-hidden','true');
        host.current.appendChild(app.canvas);
        duck = await createDuck({outfit:initial.current});
        if (disposed) {duck.dispose(); return;}
        duck.root.scale.set(.78);
        duck.root.position.set(180,253);
        app.stage.addChild(duck.root);
        rig.current = duck;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        let elapsed = 0;
        app.ticker.add(ticker => {
          const dt = Math.min(ticker.deltaMS / 1000,.05);
          elapsed += dt;
          duck.update(dt,{action:0, turn:reduced.matches ? 0 : Math.max(0,elapsed-1) * .55,
            reducedMotion:reduced.matches});
        });
        onBusy(false);
      } catch {
        if (!disposed) {onError('The preview could not load. Close and try again.'); onBusy(false);}
      }
    }
    mount();
    return () => {
      disposed = true;
      rig.current = null;
      duck?.dispose();
      if (initialized) app.destroy({removeView:true,releaseGlobalResources:false},{children:true});
    };
  }, [onBusy,onError]);

  useEffect(() => {
    if (!rig.current) return;
    let active = true;
    onBusy(true);
    onError('');
    rig.current.setOutfit(outfit).catch(() => {
      if (active) onError('This outfit could not load. Randomize to try another.');
    }).finally(() => {if (active) onBusy(false);});
    return () => {active = false;};
  }, [outfit,onBusy,onError]);

  return <div className="pixi-outfit-preview" ref={host} role="img" aria-label="Your duck wearing the preview outfit"/>;
}

function OutfitEditor({initial, island, offline, onClose}) {
  const dialog = useRef(null);
  const lifetime = useRef(null);
  const [draft,setDraft] = useState(initial);
  const [busy,setBusy] = useState(true);
  const [previewError,setPreviewError] = useState('');
  const [saveError,setSaveError] = useState('');
  const [saving,setSaving] = useState(false);
  const changed = !sameOutfit(initial,draft);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const element = dialog.current;
    island.current?.stopInput();
    element.showModal();
    return () => {controller.abort(); element.close();};
  }, [island]);

  async function save() {
    if (saving || busy || previewError || !changed) return;
    const signal = lifetime.current.signal;
    setSaving(true);
    setSaveError('');
    try {
      if (offline) {
        await island.current.setPlayerOutfit(draft);
      } else {
        const response = await fetch('/api/outfit',{
          method:'POST', headers:{'Content-Type':'application/json'}, signal,
          body:JSON.stringify({outfit:draft}),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not save your outfit. Please try again.');
      }
      if (!signal.aborted) onClose();
    } catch (error) {
      if (!signal.aborted) setSaveError(error.message || 'Could not save your outfit. Please try again.');
    } finally {
      if (!signal.aborted) setSaving(false);
    }
  }

  return <dialog ref={dialog} className="pixi-outfit-dialog" aria-labelledby="outfit-title"
    onClose={event => {if (!event.currentTarget.open) onClose();}}
    onCancel={event => {if (saving) event.preventDefault(); else onClose();}}
    onKeyDown={event => event.stopPropagation()}>
    <div className="pixi-outfit-heading">
      <h2 id="outfit-title">Change outfit</h2>
      <button className="pixi-outfit-close" type="button" aria-label="Close outfit editor" disabled={saving} onClick={onClose}>×</button>
    </div>
    <div className="pixi-outfit-stage">
      <OutfitPreview outfit={draft} onBusy={setBusy} onError={setPreviewError}/>
      <span className="pixi-outfit-shadow" aria-hidden="true"/>
      {busy && <p className="pixi-outfit-status" role="status">Loading outfit…</p>}
    </div>
    {(previewError || saveError) && <p className="pixi-outfit-error" role="alert">{previewError || saveError}</p>}
    <div className="pixi-outfit-actions">
      <button type="button" className="pixi-outfit-random" disabled={busy || saving} onClick={() => {
        setSaveError('');
        setDraft(previous => randomOutfit(previous));
      }}>Randomize</button>
      <button type="button" className="pixi-outfit-save" disabled={!changed || busy || saving || Boolean(previewError)} onClick={save}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  </dialog>;
}

export default function IslandOutfit({island, offline = false}) {
  const [initial,setInitial] = useState(null);
  const [error,setError] = useState('');
  return <>
    <button type="button" onClick={() => {
      const outfit = island.current?.player?.outfit;
      if (!outfit) {setError('Your duck is still arriving. Please try again.'); return;}
      setError('');
      setInitial({...outfit});
    }}>Change outfit</button>
    {error && <span role="status">{error}</span>}
    {initial && createPortal(<OutfitEditor initial={initial} island={island} offline={offline} onClose={() => setInitial(null)}/>,document.body)}
  </>;
}
