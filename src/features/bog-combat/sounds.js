export const BOG_SOUNDS=Object.freeze({shot:.075,splat:.13,tag:.22,ghost:.42,respawn:.3,pickup:.18,rustle:.16});
const volumes={shot:.055,splat:.085,tag:.075,ghost:.045,respawn:.065,pickup:.065,rustle:.035};
const gaps={shot:100,splat:90,tag:100,ghost:300,respawn:250,pickup:100,rustle:400};
const tau=Math.PI*2;
export function synthesizeBogSound(context,name){
  const duration=BOG_SOUNDS[name];if(!duration)return null;
  const rate=context.sampleRate,buffer=context.createBuffer(1,Math.ceil(rate*duration),rate),data=buffer.getChannelData(0);
  let phase=0,seed=7;
  for(let i=0;i<data.length;i++){
    const t=i/rate,u=t/duration,attack=Math.min(1,t/.006),fade=(1-u)*(1-u);let sample=0;
    if(name==='shot'){phase+=tau*(180+620*Math.exp(-t*75))/rate;sample=Math.sin(phase)*Math.exp(-t*42);}
    if(name==='splat'){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      phase+=tau*(115+200*Math.exp(-t*30))/rate;
      sample=(Math.sin(phase)*.7+(seed/4294967296*2-1)*.3)*Math.exp(-t*20);
    }
    if(name==='rustle'){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      sample=(seed/4294967296*2-1)*(.55+.45*Math.sin(tau*37*t))*Math.exp(-t*12);
    }
    if(name==='tag')sample=(Math.sin(tau*1046.5*t)+.3*Math.sin(tau*1568*t))*Math.exp(-t*16)*.65;
    if(name==='ghost'){phase+=tau*(340-130*u)/rate;sample=Math.sin(phase)*Math.sin(Math.PI*u)*(.8+.2*Math.sin(tau*5*t));}
    if(name==='respawn'||name==='pickup'){
      const split=name==='respawn'?.13:.075,frequency=t<split?659.25:name==='respawn'?987.77:880;
      phase+=tau*frequency/rate;
      const note=t<split?t:t-split;sample=Math.sin(phase)*Math.min(1,note/.006)*Math.exp(-note*14)*.85;
    }
    data[i]=sample*attack*fade;
  }
  return buffer;
}

export function createBogSounds(audio,{now=()=>performance.now()}={}){
  const last=Object.create(null);
  for(const name of Object.keys(BOG_SOUNDS))audio?.register?.('bog-'+name,context=>synthesizeBogSound(context,name));
  return function playSound(name){
    if(!Object.hasOwn(BOG_SOUNDS,name))return false;
    const time=now();if(time-(last[name]??-Infinity)<gaps[name])return false;
    last[name]=time;audio?.play('bog-'+name,volumes[name]);return true;
  };
}
