// Match the wispy atmosphere from three-atmosphere.js without a second renderer.
export const CLOUD_TEXTURE='/globe-atmosphere/earth-clouds.png';
export const CLOUD_OPACITY=.48;
export const CLOUD_SHADOW_OPACITY=.055;
export const CLOUD_ROTATION_RATE=.003;

export function cloudState(ball,time,reduced=false){
  const x=Math.max(0,Math.min(1,(ball-.35)/.5));
  return {fade:x*x*(3-2*x),phase:reduced?0:(time*CLOUD_ROTATION_RATE)%(2*Math.PI)};
}

export const CLOUD_SHADER=`
uniform sampler2D uClouds;
uniform float uCloudPhase;
uniform float uCloudFade;
vec3 cloudSRGB(vec3 c){
 return mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
}
float cloudCoverage(vec3 p){
 // Tilt the weather belt twelve degrees so it does not read as a horizontal ring.
 // Rotate before lookup for both clouds and shadows, keeping them together.
 p=vec3(p.x,.9781476*p.y-.2079117*p.z,.2079117*p.y+.9781476*p.z);
 // Three's texture loader flips image Y; Pixi's upload uses the image's top edge.
 vec2 uv=vec2((atan(p.z,p.x)+uCloudPhase+.4)/6.28318530718+.5,.5-asin(clamp(p.y,-1.,1.))/3.14159265359);
 vec2 dx=dFdx(uv),dy=dFdy(uv);
 // Keep mip selection continuous across the longitude seam.
 dx.x-=floor(dx.x+.5);dy.x-=floor(dy.x+.5);
 // Remove the faint all-over haze, leaving separated, softly edged wisps.
 return smoothstep(.12,.85,textureGrad(uClouds,uv,dx,dy).a);
}
vec3 atmosphere(vec3 col,vec3 p,vec2 dir,float edge){
 if(uCloudFade<=0.)return col;
 float shellEdge=edge/1.010;
 vec3 n=vec3(dir.x*shellEdge,-dir.y*shellEdge,sqrt(max(0.,1.-shellEdge*shellEdge)));
 vec3 cloudPoint=normalize(uFocus*n.z+uViewEast*n.x+uViewNorth*n.y);
 float shadow=cloudCoverage(p)*${CLOUD_SHADOW_OPACITY}*uCloudFade*smoothstep(.035,.30,sqrt(max(0.,1.-edge*edge)));
 col=mix(col,cloudSRGB(vec3(.02,.06,.08)),shadow);
 float light=clamp(dot(n,normalize(vec3(-.45,.6,1.)))/normalize(vec3(-.45,.6,1.)).z,0.,1.);
 vec3 tint=cloudSRGB(mix(vec3(.65,.78,.88),vec3(1.,.99,.97),light));
 float alpha=cloudCoverage(cloudPoint)*${CLOUD_OPACITY}*uCloudFade*smoothstep(.035,.30,n.z);
 return mix(col,tint,alpha);
}
`;
