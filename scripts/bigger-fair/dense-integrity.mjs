import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {read,write} from './design.mjs';
const S='scripts/bigger-fair/',D='rive/web/themes/fair/',A='public/pixi-art/themes/fair/';
// The previous committed Fair fix is the input to this densification round.
const before=p=>JSON.parse(execFileSync('git',['show','85119e0c:'+p],{maxBuffer:20*1024*1024}).toString());
const world=read(D+'world.json'),walk=read(D+'walk-world.json');
for(const [file,keys]of [[D+'world.json',['coast','water','bridges','walkways','sleepSpots','sleepAvoid']],[D+'walk-world.json',['coast','water','bridges','walkways']],[A+'art.json',['decks','flats','floating']]])for(const key of keys)assert.deepEqual(read(file)[key],before(file)[key],file+':'+key);
assert.deepEqual(read(D+'harbor.json'),before(D+'harbor.json'));
const oldArt=read(S+'original-art.json'),art=read(A+'art.json');assert.deepEqual(art.props.slice(0,oldArt.props.length),oldArt.props);
const previous=before(S+'design.json'),current=read(S+'design.json');
const density=plan=>plan.places.map(z=>{const homes=plan.homes.filter(h=>h.community===z.id),nearest=homes.map(h=>Math.min(...homes.filter(q=>q!==h).map(q=>Math.hypot(h.x-q.x,h.y-q.y))));return {community:z.id,homes:homes.length,meanNearestHomeDistance:Math.round(nearest.reduce((a,b)=>a+b,0)/nearest.length),spanX:Math.max(...homes.map(h=>h.x))-Math.min(...homes.map(h=>h.x)),spanY:Math.max(...homes.map(h=>h.y))-Math.min(...homes.map(h=>h.y))};});
const oldDensity=density(previous),newDensity=density(current);
for(const z of current.places){const old=previous.places.find(q=>q.id===z.id);for(const key of ['id','name','x','y','point','people','homes','work'])assert.deepEqual(z[key],old[key]);}
for(const c of newDensity){const b=oldDensity.find(q=>q.community===c.community);assert(c.meanNearestHomeDistance<b.meanNearestHomeDistance*.90,c.community+' remains too dispersed');}
write(S+'dense-integrity.json',{baseline:'85119e0c',originalGround:read(S+'pixel-native.json'),before:oldDensity,after:newDensity,waterBridgesCoastHarborOriginalArtUnchanged:true});
console.log(JSON.stringify({before:oldDensity,after:newDensity,waterBridgesCoastHarborOriginalArtUnchanged:true},null,2));
