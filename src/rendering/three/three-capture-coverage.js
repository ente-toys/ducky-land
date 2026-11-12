export function captureCoverage(aspect,heading=0,blend=0,minPixels=Infinity){
 if(!(Number.isFinite(aspect)&&aspect>0&&Number.isFinite(heading)))throw new RangeError('Capture coverage needs a positive aspect and finite heading');
 const c=Math.abs(Math.cos(heading)),s=Math.abs(Math.sin(heading));
 const edge=Math.min(.12,48/Math.max(1,minPixels));
 const flatPadding=1/(1-2*edge);
 const padding=1.5+(flatPadding-1.5)*blend;
 return Math.max(padding,(c+aspect*s)*1.08,(c+s/aspect)*1.08);
}
