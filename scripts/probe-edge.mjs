import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

export const controlPaths = ['/cdn-cgi/trace', '/api/session'];

export async function probeHttp(origin, path) {
  const started = performance.now();
  try {
    const response = await fetch(origin + path, {
      cache:'no-store', redirect:'error', signal:AbortSignal.timeout(4000),
    });
    const headersMs = Math.round(performance.now() - started);
    const edgeColo = response.headers.get('cf-ray')?.split('-').at(-1) ?? null;
    await response.arrayBuffer();
    return {path,status:response.status,edgeColo,headersMs,totalMs:Math.round(performance.now() - started)};
  } catch (error) {
    return {path,ms:Math.round(performance.now() - started),code:error.cause?.code ?? error.name};
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  while (true) {
    const results = await Promise.all(controlPaths.map(path => probeHttp('https://world.ente.com',path)));
    console.log(JSON.stringify({at:new Date().toISOString(),probes:results}));
    await delay(5000);
  }
}
