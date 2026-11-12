export function createBushRustleObserver({puff=()=>{},playSound=()=>{}}={}){
  let id=null,last=0;
  return function observe(self,time,reducedMotion=false){
    if(!self){id=null;last=0;return;}
    const entry=self.bushEntry??0;
    if(id!==self.id){id=self.id;last=entry;return;}
    const entered=entry>last;last=entry;
    if(!entered||!self.alive||!self.bushId||time-self.bushEnteredAt>.3)return;
    if(!reducedMotion)puff(self.x,self.y);
    playSound('rustle');
  };
}
