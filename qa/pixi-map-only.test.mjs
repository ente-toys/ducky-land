import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

test('the normal game entry never loads a Three.js renderer',async()=>{
  const result=await build({entryPoints:['src/main.jsx'],bundle:true,packages:'external',
    jsx:'automatic',format:'esm',write:false,metafile:true,loader:{'.css':'empty'},
    define:{'import.meta.env.DEV':'false'}});
  const inputs=Object.keys(result.metafile.inputs);
  assert.ok(inputs.some(path=>path.endsWith('/engine.js')));
  assert.deepEqual(inputs.filter(path=>/\/three-[^/]+\.js$/.test(path)),[]);
  const externalImports=Object.values(result.metafile.outputs).flatMap(output=>output.imports);
  assert.ok(!externalImports.some(entry=>/^three(?:\/|$)/.test(entry.path)));
});
