import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createSourceTracker,verifySourceSnapshot,sha256} from '../scripts/globe-svg/sources.mjs';
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ducky-globe-sources-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const put=(file,text)=>{const p=path.join(root,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);};
 put('generator.mjs',"import './shared.mjs';\nexport const version=1;\n");put('shared.mjs','export const precision=.2;\n');
 put('art/a.svg','<svg><use href="leaf.svg#leaf"/></svg>');put('art/leaf.svg','<svg id="leaf"><path fill="#ff0000"/></svg>');put('art/b.svg','<svg><path fill="#00ff00"/></svg>');
 const model={map:{id:'a',width:100,height:80,origin:{x:0,y:0},world:{coast:[[0,0],[100,0],[100,80]]}},art:{props:[{src:'a.svg',x:20,y:30}]}};
 function entry(theme,source){
  const tracker=createSourceTracker(root,theme,{codeEntries:['generator.mjs']});tracker.record(source);
  const svg='<svg>'+theme+'</svg>',ground='<svg>ground '+theme+'</svg>';
  put(`public/pixi-art/globe/${theme}.svg`,svg);put(`public/pixi-art/globe/${theme}-ground.svg`,ground);
  return {src:`/pixi-art/globe/${theme}.svg`,sha256:sha256(svg),groundSha256:sha256(ground),sources:tracker.snapshot(model)};
 }
 return {root,put,model,entry};
}
test('preview guard checks authored placement contents, not merely placement counts',t=>{
 const {root,model,entry}=fixture(t),generated=entry('a','art/a.svg');
 assert.deepEqual(verifySourceSnapshot(root,'a',generated,model),[]);
 const moved=structuredClone(model);moved.art.props[0].x++;
 assert.match(verifySourceSnapshot(root,'a',generated,moved).join('\n'),/authored placements changed/);
 const grown=structuredClone(model);grown.map.width++;
 assert.match(verifySourceSnapshot(root,'a',generated,grown).join('\n'),/map bounds/);
});
test('transitive SVG artwork changes invalidate only previews that consume it',t=>{
 const {root,put,model,entry}=fixture(t),a=entry('a','art/a.svg'),b=entry('b','art/b.svg');
 put('art/leaf.svg','<svg id="leaf"><path fill="#0000ff"/></svg>');
 assert.match(verifySourceSnapshot(root,'a',a,model).join('\n'),/changed source art\/leaf.svg/);
 assert.deepEqual(verifySourceSnapshot(root,'b',b,model),[]);
});
test('generator helper edits, missing files and modified output all fail the read-only guard',t=>{
 const {root,put,model,entry}=fixture(t),a=entry('a','art/a.svg');
 put('shared.mjs','export const precision=.1;\n');
 assert.match(verifySourceSnapshot(root,'a',a,model).join('\n'),/changed source shared.mjs/);
 fs.unlinkSync(path.join(root,'art/leaf.svg'));
 put('public/pixi-art/globe/a-ground.svg','<svg>incorrect</svg>');
 const problems=verifySourceSnapshot(root,'a',a,model).join('\n');
 assert.match(problems,/missing\/invalid source art\/leaf.svg/);assert.match(problems,/changed generated a-ground.svg/);
 const before=fs.readFileSync(path.join(root,'public/pixi-art/globe/a-ground.svg'),'utf8');
 verifySourceSnapshot(root,'a',a,model);
 assert.equal(fs.readFileSync(path.join(root,'public/pixi-art/globe/a-ground.svg'),'utf8'),before,'checking never regenerates artwork');
});
test('old manifests and tampered fingerprints cannot silently bypass freshness checks',t=>{
 const {root,model,entry}=fixture(t),a=entry('a','art/a.svg');
 assert.match(verifySourceSnapshot(root,'a',{},model).join('\n'),/missing current source fingerprint/);
 a.sources.files.pop();assert.match(verifySourceSnapshot(root,'a',a,model).join('\n'),/invalid source fingerprint/);
});
test('cached generator reads record the consumed content, even if disk changed in the meantime',t=>{
 const {root,put,model}=fixture(t),tracker=createSourceTracker(root,'a',{codeEntries:[]});
 put('art/cached.svg','<svg>new</svg>');tracker.record('art/cached.svg','<svg>old</svg>');
 assert.equal(tracker.snapshot(model).files[0].sha256,sha256('<svg>old</svg>'));
});
