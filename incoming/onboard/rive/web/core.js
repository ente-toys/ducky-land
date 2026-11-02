(function(root){
  'use strict';
  const CITIES=['Kochi','Chennai','Bengaluru','London','Mumbai','Delhi','Hyderabad','Pune','Other'];
  const CATALOG={
    cap:{label:'Cap',items:['None',...Array.from({length:13},(_,i)=>'CAP '+(i+1))]},
    shades:{label:'Shades',items:['None','Shades 2','Shades 8','Shades 12']},
    acc:{label:'Accessory',items:['None','Acc 4','Acc 5','Acc 8','Acc 9','Acc 10','Acc 11','Acc 12']},
    shoes:{label:'Shoes',items:['None',...[1,2,5,6,7,8,9,10,11,12].map(i=>'Shoes '+i)]},
  };
  function parseOutfit(search){
    const params=new URLSearchParams(search),outfit={cap:8,shades:1,acc:0,shoes:2};
    for(const [key,slot] of Object.entries(CATALOG)){
      const raw=params.get(key)??(key==='acc'?params.get('accessory'):null);
      if(raw!==null&&/^\d+$/.test(raw)&&Number(raw)<slot.items.length)outfit[key]=Number(raw);
    }
    return outfit;
  }
  const cleanName=value=>[...value.replace(/[\u0000-\u001f\u007f]/g,'').trim()].slice(0,18).join('');
  function dripURL(base,outfit,name,city){
    const url=new URL(base);url.search='';
    for(const key of Object.keys(CATALOG))url.searchParams.set(key,outfit[key]);
    const safeName=cleanName(name);if(safeName)url.searchParams.set('name',safeName);
    if(CITIES.includes(city))url.searchParams.set('city',city);
    return url.href;
  }
  function photoCrop(ducks,player,aspect){
    const nearby=ducks.filter(d=>d!==player&&Math.hypot(d.x-player.x,(d.y-player.y)*1.2)<450).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)).slice(0,4);
    const subjects=[player];
    // Admit a neighbour only when the whole little group fits this format.
    // The player's head and feet must survive even at the plaza's edges.
    for(const duck of nearby){
      const test=[...subjects,duck];
      const neededW=Math.max(...test.map(d=>d.x+105))-Math.min(...test.map(d=>d.x-105))+100;
      const neededH=Math.max(...test.map(d=>d.y+55))-Math.min(...test.map(d=>d.y-230))+90;
      if(Math.max(760,neededW,neededH*aspect)<=Math.min(1600,1000*aspect))subjects.push(duck);
    }
    const left=Math.min(...subjects.map(d=>d.x-105)),right=Math.max(...subjects.map(d=>d.x+105));
    const top=Math.min(...subjects.map(d=>d.y-230)),bottom=Math.max(...subjects.map(d=>d.y+55));
    let width=Math.max(760,right-left+100,(bottom-top+90)*aspect),height=width/aspect;
    if(width>1600){width=1600;height=width/aspect;}if(height>1000){height=1000;width=height*aspect;}
    const cx=(left+right)/2,cy=(top+bottom)/2;
    return {x:Math.max(0,Math.min(1600-width,cx-width/2)),y:Math.max(0,Math.min(1000-height,cy-height/2)),width,height,subjects:subjects.map(d=>d.name)};
  }
  const api={CATALOG,CITIES,parseOutfit,cleanName,dripURL,photoCrop};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DuckyJoinCore=api;
})(globalThis);
