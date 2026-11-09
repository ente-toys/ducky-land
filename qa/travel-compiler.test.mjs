import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTravelCompiler} from './travel-compiler.mjs';

test('local travel authority reloads when an imported walking map changes, without restarting the fixture',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sunbob-walk-reload-'));
  const file=join(dir,'walk-world.json');
  writeFileSync(file,JSON.stringify({obstacles:['old step rings']}));
  let latest,changed;
  const refreshed=new Promise(resolve=>{changed=resolve;});
  const compiler=await createTravelCompiler({stdin:{resolveDir:dir,contents:"export {default} from './walk-world.json';"}},async bundle=>{
    latest=(await import('data:text/javascript;base64,'+Buffer.from(bundle).toString('base64'))).default;
    if(latest.obstacles[0]==='clock planter')changed();
  });
  let timer;
  try{
    await compiler.rebuild();
    assert.deepEqual(latest.obstacles,['old step rings']);
    await compiler.watch();
    writeFileSync(file,JSON.stringify({obstacles:['clock planter']}));
    await Promise.race([refreshed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('walking map stayed stale')),5000);})]);
    assert.deepEqual(latest.obstacles,['clock planter']);
  }finally{
    clearTimeout(timer);await compiler.dispose();rmSync(dir,{recursive:true,force:true});
  }
});
