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

  return <dialog ref={dialog} className="pixi-star-dialog" aria-labelledby="star-title"
    aria-describedby="star-description" onClose={onClose}>
    <h2 id="star-title">Star Ente to join the island</h2>
    <p id="star-description">You’re signed in! Playing is available to people who have starred
      {' '}<strong>ente/ente</strong> on GitHub. Give it a star, then come back and check again.</p>
    {error && <p role="alert">{error}</p>}
    <div className="pixi-star-actions">
      <a href="https://github.com/ente/ente" target="_blank" rel="noopener noreferrer">Star ente/ente ↗</a>
      <button onClick={retry} disabled={checking}>{checking ? 'Checking…' : 'I’ve starred it — check again'}</button>
      {signInRequired && <a href="/auth/github/start">Sign in again</a>}
      <button onClick={onClose}>Keep watching</button>
    </div>
  </dialog>;
}
