import {useEffect, useRef, useState} from 'react';
import {Application} from 'pixi.js';
import {createDuck, getDuckWardrobe} from '../rendering/pixi/duck.js';
import {OUTFIT_OPTIONS, randomOutfit, sameOutfit} from '../gameplay/outfits.js';

const outfitRows = {cap:'Hats', shades:'Glasses', shoes:'Shoes'};

// The editor's item grid: one slot at a time (the tabs pick it), round tiles in a 4-up grid.
export function OutfitGrid({wardrobe, slot, outfit, disabled, onChange}) {
  const items = wardrobe.filter(item => item.slot === slot && OUTFIT_OPTIONS[slot].includes(item.index));
  return <div className="pixi-outfit-grid" role="group" aria-label={outfitRows[slot]}>
    {[{index:0,name:'None'}, ...items].map(item => <button type="button" key={item.index}
      className="pixi-outfit-tile" title={item.name} aria-label={item.name} disabled={disabled}
      aria-pressed={outfit[slot] === item.index} onClick={() => onChange({...outfit,[slot]:item.index})}>
      {item.index === 0 ? <span className="pixi-outfit-none">None</span> : item.frames['0'].filter(frame => frame.visible).map(frame =>
        <img key={frame.url} src={frame.url} alt="" draggable="false"/>)}
    </button>)}
  </div>;
}

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
        await app.init({width:360, height:360, backgroundAlpha:0, antialias:true,
          resolution:Math.max(2, Math.min(devicePixelRatio || 1, 3)), autoDensity:true, preference:'webgl'});
        initialized = true;
        if (disposed) {app.destroy({removeView:true,releaseGlobalResources:false},{children:true}); return;}
        app.canvas.setAttribute('aria-hidden','true');
        Object.assign(app.canvas.style,{width:'100%',height:'100%'});
        host.current.appendChild(app.canvas);
        duck = await createDuck({outfit:initial.current});
        if (disposed) {duck.dispose(); return;}
        duck.root.scale.set(.95);
        duck.root.position.set(180,320);
        app.stage.addChild(duck.root);
        rig.current = duck;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        let elapsed = 0;
        app.ticker.add(ticker => {
          const dt = Math.min(ticker.deltaMS / 1000,.05);
          elapsed += dt;
          duck.update(dt,{action:0, turn:0, reducedMotion:reduced.matches});   // faces you, never turns
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

export function OutfitEditor({initial, island, offline, onClose, initialTab = 'cap', onSaved}) {
  const dialog = useRef(null);
  const lifetime = useRef(null);
  const [draft,setDraft] = useState(initial);
  const [busy,setBusy] = useState(true);
  const [previewError,setPreviewError] = useState('');
  const [saveError,setSaveError] = useState('');
  const [saving,setSaving] = useState(false);
  const [wardrobe,setWardrobe] = useState(null);
  const [wardrobeError,setWardrobeError] = useState('');
  const [tab,setTab] = useState(initialTab);
  const changed = !sameOutfit(initial,draft);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const element = dialog.current;
    island.current?.stopInput();
    element.showModal();
    getDuckWardrobe().then(items => {
      if (!controller.signal.aborted) setWardrobe(items);
    }).catch(() => {
      if (!controller.signal.aborted) setWardrobeError('Could not load items. Close and try again.');
    });
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
      if (!signal.aborted) {onSaved?.(draft); onClose();}
    } catch (error) {
      if (!signal.aborted) setSaveError(error.message || 'Could not save your outfit. Please try again.');
    } finally {
      if (!signal.aborted) setSaving(false);
    }
  }

  // layout after the boss's reference: the duck large on a stand on the left, a card on the right with a tab
  // per slot, a grid of round tiles, and Randomize / Done at the bottom
  return <dialog ref={dialog} className="pixi-outfit-dialog" aria-labelledby="outfit-title"
    onClose={event => {if (!event.currentTarget.open) onClose();}}
    onCancel={event => {if (saving) event.preventDefault(); else onClose();}}
    onKeyDown={event => event.stopPropagation()}>
    <h2 id="outfit-title" className="pixi-outfit-title">Change outfit</h2>
    <button className="pixi-outfit-close" type="button" aria-label="Close outfit editor" disabled={saving} onClick={onClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button>
    <div className="pixi-outfit-content">
      <div className="pixi-outfit-stage">
        {/* the stand lives in the same box as the duck, so his feet always land on it */}
        <div className="pixi-outfit-figure">
          <span className="pixi-outfit-stand" aria-hidden="true"/>
          <OutfitPreview outfit={draft} onBusy={setBusy} onError={setPreviewError}/>
        </div>
        {busy && <p className="pixi-outfit-status sr-only" role="status">Loading outfit</p>}
      </div>
      <div className="pixi-outfit-card">
        <div className="pixi-outfit-tabs" role="tablist" aria-label="Outfit parts">
          {Object.entries(outfitRows).map(([slot,label]) => <button type="button" role="tab" key={slot}
            aria-selected={tab === slot} onClick={() => setTab(slot)}>{label}</button>)}
        </div>
        {wardrobe ? <OutfitGrid wardrobe={wardrobe} slot={tab} outfit={draft} disabled={busy || saving} onChange={next => {
          setSaveError('');
          setDraft(next);
        }}/> : <p className="pixi-outfit-loading" role="status">{wardrobeError || 'Loading items…'}</p>}
        {(previewError || saveError) && <p className="pixi-outfit-error" role="alert">{previewError || saveError}</p>}
        <div className="pixi-outfit-actions">
          <button type="button" className="pixi-outfit-random" disabled={busy || saving} onClick={() => {
            setSaveError('');
            setDraft(previous => randomOutfit(previous));
          }}><svg className="pixi-outfit-dice" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.4"/><circle cx="15.5" cy="8.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="8.5" cy="15.5" r="1.4"/><circle cx="15.5" cy="15.5" r="1.4"/></svg>Randomize</button>
          <button type="button" className="pixi-outfit-save" disabled={busy || saving || Boolean(previewError)}
            onClick={() => changed ? save() : onClose()}>{saving ? 'Saving…' : 'Done'}</button>
        </div>
      </div>
    </div>
  </dialog>;
}
