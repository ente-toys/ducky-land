// Same qa/*.test.mjs scope as npm test. Only the real ws server and Miniflare
// integration files require sockets. Keep network.test's two pure checks too.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const excluded=new Set(['network.test.mjs','multiplayer.test.mjs']);
// Wall-clock performance assertions must not compete with the runner's own
// parallel navigation/render workers. Keep every test and original threshold.
const exclusive=new Set(['spacious.test.mjs','render-performance.test.mjs']);
const files=fs.readdirSync('qa').filter(f=>f.endsWith('.test.mjs')&&!excluded.has(f)&&!exclusive.has(f)).sort().map(f=>'qa/'+f);
console.log(`Running ${files.length} non-socket files in parallel, then ${exclusive.size} timing-sensitive files in isolation; excluding real network/Miniflare integration.`);
execFileSync(process.execPath,['--test','--test-concurrency=4',...files],{stdio:'inherit'});
execFileSync(process.execPath,['--test','--test-concurrency=1',...[...exclusive].map(f=>'qa/'+f)],{stdio:'inherit'});
execFileSync(process.execPath,['--test','--test-name-pattern=remote interpolation|adapted social crowd','qa/network.test.mjs'],{stdio:'inherit'});
