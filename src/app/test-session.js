const testKey = new URLSearchParams(typeof location === 'undefined' ? '' : location.hash.slice(1)).get('multiplayer-test');
let pending;
let token;

export function testSession() {
  if (!testKey) return null;
  return pending ??= fetch('/api/test-session', {
    method: 'POST',
    headers: {'X-Multiplayer-Test-Key': testKey},
  }).then(async response => {
    if (!response.ok) throw new Error('Multiplayer testing is unavailable');
    const result = await response.json();
    token = result.token;
    return {user: result.user, signInAvailable: false};
  });
}

export function authenticateTestSocket(url) {
  if (token) url.searchParams.set('testSession', token);
}
