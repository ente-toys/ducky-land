const sessionCookie = '__Host-ducky_session';
const flowCookie = '__Host-ducky_oauth';
const cookieAge = 7 * 24 * 60 * 60;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}

function randomToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function digest(value) {
  if (!value) return null;
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}

function cookie(request, name) {
  const entry = (request.headers.get('Cookie') ?? '').split(';')
    .map(part => part.trim()).find(part => part.startsWith(name+'='));
  const value = entry?.slice(name.length+1);
  return tokenPattern.test(value ?? '') ? value : null;
}

function setCookie(name, value, age) {
  return `${name}=${value}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Lax`;
}

function json(body, status = 200, headers = {}) {
  return Response.json(body, {status, headers:{'Cache-Control':'no-store', ...headers}});
}

function redirect(to, cookies = []) {
  const headers = new Headers({Location:to,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null,{status:303,headers});
}

function room(env) {
  return env.ISLAND.get(env.ISLAND.idFromName('main-island'));
}

function call(env, path, data) {
  return room(env).fetch(new Request('https://island.internal'+path, {
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),
  }));
}

function configured(env) {
  return !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.SITE_ORIGIN);
}

export async function start({request,env}) {
  if (!configured(env)) return json({error:'GitHub sign-in is not configured yet.'},503);
  if (new URL(request.url).origin !== env.SITE_ORIGIN) {
    return redirect(env.SITE_ORIGIN+'/auth/github/start');
  }
  const state = randomToken(), verifier = randomToken();
  const previous = await digest(cookie(request,flowCookie));
  const saved = await call(env,'/flow',{state:await digest(state),verifier,previous});
  if (!saved.ok) return json({error:'Sign-in is busy. Try again shortly.'},saved.status);
  const target = new URL('https://github.com/login/oauth/authorize');
  target.search = new URLSearchParams({
    client_id:env.GITHUB_CLIENT_ID, redirect_uri:env.SITE_ORIGIN+'/auth/github/callback',
    state, code_challenge:await digest(verifier), code_challenge_method:'S256',
  });
  return redirect(target.href,[setCookie(flowCookie,state,600)]);
}

export async function callback({request,env}, fetchGitHub = fetch) {
  const url = new URL(request.url);
  const clearFlow = setCookie(flowCookie,'',0);
  const failed = reason => redirect('/?auth='+reason,[clearFlow]);
  if (!configured(env) || url.origin !== env.SITE_ORIGIN) return failed('failed');
  const state = cookie(request,flowCookie);
  if (!state || url.searchParams.get('state') !== state) return failed('failed');
  try {
    const response = await call(env,'/consume',{state:await digest(state)});
    if (!response.ok) return failed('failed');
    const {verifier} = await response.json();
    if (url.searchParams.get('error') === 'access_denied') return failed('cancelled');
    const code = url.searchParams.get('code');
    if (!code || code.length > 512) return failed('failed');
    const exchange = await fetchGitHub('https://github.com/login/oauth/access_token',{
      method:'POST',headers:{Accept:'application/json'},
      body:new URLSearchParams({
        client_id:env.GITHUB_CLIENT_ID, client_secret:env.GITHUB_CLIENT_SECRET, code,
        code_verifier:verifier, redirect_uri:env.SITE_ORIGIN+'/auth/github/callback',
      }),
    });
    if (!exchange.ok) return failed('failed');
    const token = (await exchange.json()).access_token;
    if (!token) return failed('failed');
    const user = await fetchGitHub('https://api.github.com/user',{
      headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'User-Agent':'Ducky Land'},
    });
    if (!user.ok) return failed('failed');
    const {id,login} = await user.json();
    if (!Number.isSafeInteger(id) || id <= 0 || typeof login !== 'string' || !/^[A-Za-z0-9-]{1,39}$/.test(login)) return failed('failed');
    const starred = await fetchGitHub('https://api.github.com/user/starred/ente/ente',{
      headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'User-Agent':'Ducky Land'},
    });
    if (![204,404].includes(starred.status)) return failed('star-check');
    const canPlay = starred.status === 204;
    const session = randomToken();
    const saved = await call(env,'/session/new',{digest:await digest(session),account:String(id),login,canPlay,githubToken:token});
    if (!saved.ok) return failed('failed');
    const previous = await digest(cookie(request,sessionCookie));
    if (previous) await call(env,'/session/revoke',{digest:previous});
    return redirect('/',[clearFlow,setCookie(sessionCookie,session,cookieAge)]);
  } catch {
    return failed('failed');
  }
}

export async function session({request,env}) {
  const key = await digest(cookie(request,sessionCookie));
  if (!key) return json({user:null,signInAvailable:configured(env)});
  const result = await call(env,'/session/get',{digest:key});
  if (!result.ok) return json({error:'Session unavailable'},503);
  const user = await result.json();
  return json({user:user ? {accountId:user.account,login:user.login,canPlay:!!user.canPlay} : null,signInAvailable:configured(env)},
    200, user ? {} : {'Set-Cookie':setCookie(sessionCookie,'',0)});
}

export async function logout({request,env}) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({},403);
  const key = await digest(cookie(request,sessionCookie));
  if (key && !(await call(env,'/session/revoke',{digest:key})).ok) return json({},503);
  return json({},200,{'Set-Cookie':setCookie(sessionCookie,'',0)});
}

export async function friends({request,env}) {
  if (!['GET','POST','PATCH','DELETE'].includes(request.method)) return json({error:'Method not allowed.'},405);
  if (request.method !== 'GET' && request.headers.get('Origin') !== new URL(request.url).origin) return json({},403);
  const key = await digest(cookie(request,sessionCookie));
  if (!key) return json({error:'Please sign in again to manage friends.'},401);
  let data = {};
  if (request.method !== 'GET') {
    const body = await request.text();
    if (body.length > 512) return json({error:'Invalid request.'},400);
    try { data = JSON.parse(body); } catch { return json({error:'Invalid request.'},400); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return json({error:'Invalid request.'},400);
  }
  try {
    return await call(env,'/friends',{playerId:data.playerId,accountId:data.accountId,action:data.action,digest:key,method:request.method});
  } catch {
    return json({error:'Friends are unavailable. Please try again.'},503);
  }
}

export async function connect({request,env}, fetchGitHub = fetch) {
  const url = new URL(request.url);
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({},426);
  if (request.headers.get('Origin') !== url.origin) return json({},403);
  const headers = new Headers({Upgrade:'websocket'});
  const key = await digest(cookie(request,sessionCookie));
  if (key) headers.set('X-Session-Digest',key);
  const play = url.searchParams.get('play') === '1' ? '1' : '0';
  if (key && play === '1') {
    const check = await checkPlayAccess(env,key,fetchGitHub);
    if (check.error && check.status !== 401) return json({error:check.error},check.status);
  }
  return room(env).fetch(new Request('https://island.internal/room?play='+play,{headers}));
}

async function checkPlayAccess(env, key, fetchGitHub) {
  const result = await call(env,'/session/get',{digest:key});
  if (!result.ok) return {error:'Session unavailable. Please try again.',status:503};
  const user = await result.json();
  if (!user?.githubToken) {
    if (user) await call(env,'/session/access',{digest:key,canPlay:false});
    return {error:'Please sign in again to check your GitHub star.',status:401};
  }
  let starred;
  try {
    starred = await fetchGitHub('https://api.github.com/user/starred/ente/ente',{
      headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+user.githubToken,'User-Agent':'Ducky Land'},
    });
  } catch {
    return {error:'Could not check your GitHub star. Please try again.',status:503};
  }
  if (![204,404].includes(starred.status)) {
    await call(env,'/session/access',{digest:key,canPlay:false});
    return {error:starred.status === 401 ? 'Please sign in again to check your GitHub star.' :
      'Could not check your GitHub star. Please try again.',status:starred.status === 401 ? 401 : 503};
  }
  const canPlay = starred.status === 204;
  const saved = await call(env,'/session/access',{digest:key,canPlay});
  if (!saved.ok) return {error:'Could not update play access. Please try again.',status:503};
  return {canPlay};
}

export async function playAccess({request,env}, fetchGitHub = fetch) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({},403);
  const key = await digest(cookie(request,sessionCookie));
  if (!key) return json({error:'Please sign in again to check your GitHub star.'},401);
  const result = await checkPlayAccess(env,key,fetchGitHub);
  return json(result,result.status ?? 200);
}
