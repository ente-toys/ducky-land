// Rotate only the hub-pivoted sail sprite; the tower and its ground footprint stay fixed.
export function homePropRotation(prop,time,reduced=false,index=0){
 if(reduced)return 0;
 if(prop.sweepPeriod)return Math.sin(time*Math.PI*2/prop.sweepPeriod)*(prop.sweepAngle??.16);
 if(prop.spinPeriod)return time*Math.PI*2/prop.spinPeriod;
 return prop.boat?Math.sin(time*1.1+index)*.008:0;
}
