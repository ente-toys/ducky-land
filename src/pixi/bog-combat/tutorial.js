export const BOG_TIPS=Object.freeze([
  'WASD / arrows to move, Shift to run',
  'Space to shoot, your paint goes where you face',
  'Tagged? You respawn hidden for 7 s. 5 lives, then you paddle to a random islet.',
]);
const actions=['move','shoot','tagged'],seenThisSession=new Set();
export const bogTutorialKey=identity=>'ducky-bog-tutorial-v1:'+String(identity||'local');

export function createBogTutorial({identity,storage,schedule=setTimeout,cancel=clearTimeout,onChange=()=>{}}={}){
  const key=bogTutorialKey(identity);let step=-1,timer=null,started=false,disposed=false;
  // Access to localStorage itself can throw in private / restricted contexts.
  if(storage===undefined)try{storage=globalThis.localStorage;}catch{}
  const clear=()=>{if(timer!==null)cancel(timer);timer=null;};
  function show(index){clear();step=index;if(index<BOG_TIPS.length)timer=schedule(()=>show(index+1),5000);onChange(step);}
  return {
    start(){
      // React StrictMode restarts the same mounted tutorial's effect. Resume
      // its timer without treating that effect replay as a second visit.
      if(started){if(disposed&&step>=0&&step<BOG_TIPS.length){disposed=false;show(step);}return false;}
      if(disposed)return false;started=true;
      let seen=seenThisSession.has(key);try{seen||=storage?.getItem(key)==='seen';}catch{}
      if(seen)return false;
      seenThisSession.add(key);try{storage?.setItem(key,'seen');}catch{}
      show(0);return true;
    },
    action(action){if(!disposed&&step>=0&&step<actions.length&&actions[step]===action)show(step+1);},
    skip(){if(!disposed&&step>=0)show(BOG_TIPS.length);},
    dispose(){disposed=true;clear();},
  };
}
