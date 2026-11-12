// Local-only identities demonstrate the interaction; these are not GitHub records.
const names=['you','mallard','pekin','teal','eider','wigeon','pintail','gadwall'];
export const DEMO_SKY={total:30_000,me:{accountId:'1',login:'you',starred:true},
  online:Array.from({length:142},(_,i)=>String(i+1)),friends:['2','6'],
  players:Array.from({length:180},(_,i)=>[String(i+1),names[i]??`demo-ducky-${i+1}`])};
