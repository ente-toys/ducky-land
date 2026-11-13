export function homePropY(prop,time,reduced=false,index=0){
 if(reduced||!prop.boat)return prop.y;
 const bob=prop.animation?.type==='bob'?prop.animation:null;
 return prop.y+Math.sin(time*(bob?Math.PI*2/bob.periodSeconds:1.5)+(bob?.phaseRadians??index))*(bob?.translateYWorld??3);
}
export function homePropRotation(prop,time,reduced=false,index=0){
 if(reduced)return 0;
 if(prop.spinPeriod)return time*Math.PI*2/prop.spinPeriod;
 if(!prop.boat)return 0;
 const bob=prop.animation?.type==='bob'?prop.animation:null;
 return bob?Math.sin(time*Math.PI*2/bob.periodSeconds+bob.phaseRadians+.7)*bob.rotateRadians:Math.sin(time*1.1+index)*.008;
}
