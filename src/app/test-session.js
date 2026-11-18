const testId = '919c4104-faed-4a20-931c-9b3abec359ab';
const testing = typeof location !== 'undefined' && location.hash === '#' + testId;
let pending;
let token;

export function testSession() {
  if (!testing) return null;
  return pending ??= fetch('/api/test-session', {
    method: 'POST',
    headers: {'X-Multiplayer-Test-Id': testId},
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
