import {useEffect, useRef, useState} from 'react';

const actionPaths = {
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4',
  share: 'M12 15V3m-4 4 4-4 4 4m-9 4H5v10h14V11h-2',
  copy: 'M8 8V3h12v12h-4m0-7H4v13h12z',
  close: 'm6 6 12 12M18 6 6 18',
};

function ActionIcon({name}) {
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={actionPaths[name]}/>
  </svg>;
}

function Polaroid({file, onClose}) {
  const dialog = useRef(null);
  const [url, setUrl] = useState('');
  const [printed, setPrinted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const files = [file];
  const canShare = navigator.share && navigator.canShare?.({files});
  const canCopy = navigator.clipboard?.write && typeof ClipboardItem === 'function'
    && (ClipboardItem.supports?.('image/png') ?? true);

  useEffect(() => {
    const element = dialog.current;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    element.showModal();
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function share() {
    setFeedback('');
    try {
      await navigator.share({files});
    } catch (error) {
      if (error.name !== 'AbortError') setFeedback('Could not share the photo. Try downloading it.');
    }
  }

  async function copy() {
    setFeedback('');
    try {
      await navigator.clipboard.write([new ClipboardItem({'image/png': file})]);
      setFeedback('Photo copied.');
    } catch {
      setFeedback('Could not copy the photo. Try downloading it.');
    }
  }

  return <dialog className="pixi-polaroid" ref={dialog} aria-label="Polaroid preview"
    onClose={onClose} onKeyDown={event => event.stopPropagation()}
    onClick={event => {
      if (event.target === event.currentTarget) dialog.current.close();
    }}>
    <div className="pixi-polaroid-printer">
      <div className="pixi-polaroid-camera" aria-hidden="true">
        <span className="pixi-polaroid-shutter"/>
        <span className="pixi-polaroid-flash"/>
        <span className="pixi-polaroid-lens"/>
      </div>
      <div className="pixi-polaroid-output">
        {url && <img className="pixi-polaroid-photo" data-printed={printed} src={url}
          alt="Polaroid of your Ducky Land scene" onLoad={() => setPrinted(true)}/>}
      </div>
    </div>
    <div className="pixi-polaroid-actions">
      {url && <a href={url} download={file.name} aria-label="Download" title="Download">
        <ActionIcon name="download"/>
      </a>}
      {canShare && <button type="button" aria-label="Share" title="Share" onClick={share}>
        <ActionIcon name="share"/>
      </button>}
      {canCopy && <button type="button" aria-label="Copy image" title="Copy image" onClick={copy}>
        <ActionIcon name="copy"/>
      </button>}
      <button type="button" aria-label="Close Polaroid" title="Close Polaroid" autoFocus
        onClick={() => dialog.current.close()}><ActionIcon name="close"/></button>
    </div>
    <div className="pixi-polaroid-feedback" role="status">{feedback}</div>
  </dialog>;
}

export default function IslandCamera({island, ready}) {
  const button = useRef(null);
  const request = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);

  useEffect(() => () => {request.current = null;}, []);

  async function takePhoto() {
    if (!ready || !island.current || request.current || file) return;
    const pending = island.current.capturePhoto();
    request.current = pending;
    setBusy(true);
    setError('');
    try {
      const blob = await pending;
      if (request.current !== pending || document.querySelector('dialog:modal, .bog-combat-dock')) return;
      island.current?.stopInput();
      setFile(new File([blob], `ducky-land-${Date.now()}.png`, {type:'image/png'}));
    } catch {
      if (request.current === pending) setError('Could not take a photo. Try again.');
    } finally {
      if (request.current === pending) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  return <div className="pixi-camera">
    <button type="button" ref={button} aria-label="Take photo" title="Take photo"
      aria-busy={busy} aria-haspopup="dialog" disabled={!ready} onClick={takePhoto}>
      <span className="pixi-camera-icon" aria-hidden="true"/>
    </button>
    <div className="pixi-camera-error" role="status">{error}</div>
    {file && <Polaroid file={file} onClose={() => {setFile(null); button.current.focus();}}/>}
  </div>;
}
