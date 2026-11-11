import {useEffect, useRef, useState} from 'react';

export default function StarDialog({onClose, onConfirm}) {
  const dialog = useRef(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [signInRequired, setSignInRequired] = useState(false);

  async function retry() {
    setChecking(true);
    setError('');
    try {
      const response = await fetch('/api/play-access',{method:'POST'});
      const result = await response.json();
      if (!response.ok) {
        setSignInRequired(response.status === 401);
        throw new Error(result.error || 'Could not check your star. Please try again.');
      }
      if (result.canPlay) onConfirm();
      else setError('No star found yet. Star ente/ente with the GitHub account you used to sign in, then try again.');
    } catch (error) {
      setError(error.message || 'Could not check your star. Please try again.');
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return <dialog ref={dialog} className="pixi-dialog pixi-star-dialog" aria-labelledby="star-title"
    aria-describedby="star-description" onClose={event => {if (!event.currentTarget.open) onClose();}}
    onKeyDown={event => event.stopPropagation()}>
    <header className="pixi-dialog-header"><h2 id="star-title">Star Ente to join the island</h2></header>
    <div className="pixi-dialog-body">
      <p id="star-description">Star <strong>ente/ente</strong> on GitHub with the account you signed in with, then check again to start playing.</p>
      {error && <p className="pixi-dialog-error" role="alert">{error}</p>}
    </div>
    <footer className="pixi-dialog-footer pixi-star-actions">
      <a className="pixi-dialog-button pixi-dialog-primary" href="https://github.com/ente/ente" target="_blank" rel="noopener noreferrer">Star ente/ente ↗</a>
      <button className="pixi-dialog-button" type="button" onClick={retry} disabled={checking}>{checking ? 'Checking…' : 'I’ve starred it — check again'}</button>
      {signInRequired && <a className="pixi-dialog-button" href="/auth/github/start">Sign in again</a>}
      <button className="pixi-dialog-button pixi-star-watch" type="button" onClick={onClose}>Keep watching</button>
    </footer>
  </dialog>;
}
