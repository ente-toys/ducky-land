const assert=require('node:assert/strict');
const fs=require('node:fs');
const {CATALOG,CITIES,parseOutfit,cleanName,dripURL,photoCrop}=require('./rive/web/core.js');
const passed=[];
function check(name,fn){fn();passed.push(name);}
check('All 33 permitted items and all nine flocks',()=>{
  assert.equal(Object.values(CATALOG).reduce((n,s)=>n+s.items.length-1,0),33);
  assert.deepEqual(CITIES,['Kochi','Chennai','Bengaluru','London','Mumbai','Delhi','Hyderabad','Pune','Other']);
  assert(!CATALOG.acc.items.includes('Acc 6'));
});
check('URL applies every slot and preserves none',()=>{
  assert.deepEqual(parseOutfit('?cap=3&shades=1&acc=7&shoes=10'),{cap:3,shades:1,acc:7,shoes:10});
  assert.deepEqual(parseOutfit('?cap=0&shades=0&acc=0&shoes=0'),{cap:0,shades:0,acc:0,shoes:0});
});
check('Invalid, negative, fractional and overflow values use valid defaults',()=>{
  for(const raw of ['-1','1.5','Infinity','NaN','9999999999999999999999','abc','']){
    assert.deepEqual(parseOutfit(new URLSearchParams({cap:raw,shades:raw,acc:raw,shoes:raw})),{cap:8,shades:1,acc:0,shoes:2});
  }
  assert.deepEqual(parseOutfit('?cap=14&shades=4&acc=8&shoes=11'),{cap:8,shades:1,acc:0,shoes:2});
});
check('Every allowed slot index is accepted exactly',()=>{
  for(const [key,slot] of Object.entries(CATALOG))for(let i=0;i<slot.items.length;i++)assert.equal(parseOutfit(new URLSearchParams({[key]:i}))[key],i);
  assert.equal(parseOutfit('?accessory=3').acc,3);
});
check('Name controls are removed, unicode survives, length is bounded',()=>{
  assert.equal(cleanName('  Pragi\n\t  '),'Pragi');
  assert.equal(cleanName('കുഞ്ഞ്'),'കുഞ്ഞ്');
  assert.equal([...cleanName('🐤'.repeat(25))].length,18);
});
check('A copied outfit link round-trips safely',()=>{
  const outfit={cap:13,shades:3,acc:7,shoes:10};
  const url=dripURL('http://127.0.0.1:8806/?qa=1',outfit,'a&b <ducky>','London');
  const parsed=new URL(url);assert.deepEqual(parseOutfit(parsed.search),outfit);
  assert.equal(parsed.searchParams.get('name'),'a&b <ducky>');assert.equal(parsed.searchParams.get('city'),'London');assert(!parsed.searchParams.has('qa'));
});
check('Wide and square crop include the complete player and stay in the world',()=>{
  for(const x of [250,400,800,1200,1350])for(const y of [360,540,800,900])for(const aspect of [1504/622,1104/902]){
    const p={x,y,name:'you'};
    const crowd=Array.from({length:12},(_,i)=>({x:Math.max(180,Math.min(1420,x+Math.sin(i*1.7)*390)),y:Math.max(300,Math.min(930,y+Math.cos(i*1.7)*350)),name:'duck'+i}));
    const c=photoCrop([p,...crowd],p,aspect);
    assert(c.x>=0&&c.y>=0&&c.x+c.width<=1600+.001&&c.y+c.height<=1000+.001);
    assert(Math.abs(c.width/c.height-aspect)<.0001);
    assert(c.x<=x-105&&c.x+c.width>=x+105&&c.y<=y-230&&c.y+c.height>=y+55);
    assert(c.subjects.includes('you'));
  }
});
check('The welcome flock is framed with the player in both formats',()=>{
  const p={x:800,y:820,name:'you'},crowd=[p,{x:650,y:790,name:'quackers'},{x:955,y:805,name:'mo'},{x:1100,y:720,name:'aya_22'}];
  for(const aspect of [1504/622,1104/902])assert(photoCrop(crowd,p,aspect).subjects.length>=3);
});
const result={status:'pass',checks:passed.length,passed,note:'Pure logic checks, not browser or visual verification.'};
fs.writeFileSync('shots/core-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
