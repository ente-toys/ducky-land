// Exact pop, drift, tilt and fade sampled from the existing live world-view.js.
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const out=x=>1-Math.pow(1-Math.max(0,Math.min(1,x)),3);
export function heartPose(sec,seed=0){
 const spring=1-Math.exp(-sec*9)*Math.cos(sec*22),lift=out((sec-.35)/1.4),gone=ease((sec-1.1)/.6);
 return {scale:Math.max(0,spring)*(1-gone*.35)*.9,squash:0,x:Math.sin(sec*4+seed)*1.5*lift,
 y:-(8+lift*22),rotation:Math.exp(-sec*7)*Math.sin(sec*18)*.35,alpha:1-gone,
 spark:ease(sec/.06)*(1-ease((sec-.1)/.35))};
}
