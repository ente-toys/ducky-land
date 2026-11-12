import {smoothstep} from './globe-math.js';
import * as Globe from './globe-mesh.js';
import {PALETTE} from './palette.js';

// Water stays below the island surface. Only its lighting normals move, so
// shorelines, island artwork and the zoom/picking sphere remain unchanged.
export function createGlobeAtmosphere(globe,scene,planetShade){
  const time={value:0};
  const water=new Globe.ShaderMaterial({
    uniforms:{seaColor:{value:new Globe.Color(PALETTE.water)},planetShade,time},
    vertexShader:`
      varying vec3 oceanPoint; varying vec3 oceanNormal; varying vec3 oceanView; varying mat3 oceanBasis;
      void main(){
        oceanPoint=normalize(position);oceanNormal=normalize(normalMatrix*normal);oceanBasis=normalMatrix;
        vec4 p=modelViewMatrix*vec4(position,1.);oceanView=-p.xyz;
        gl_Position=projectionMatrix*p;
      }`,
    fragmentShader:`
      uniform vec3 seaColor; uniform float planetShade; uniform float time;
      varying vec3 oceanPoint; varying vec3 oceanNormal; varying vec3 oceanView; varying mat3 oceanBasis;
      void main(){
        vec3 p=normalize(oceanPoint),a=vec3(37.,13.,29.),b=vec3(-23.,41.,17.),c=vec3(19.,-31.,43.);
        float wa=dot(p,a)+time*.65,wb=dot(p,b)-time*.48,wc=dot(p,c)+time*.36;
        vec3 slope=a*cos(wa)*.0008+b*cos(wb)*.0005+c*cos(wc)*.00035;
        slope-=p*dot(slope,p);
        vec3 n=normalize(oceanNormal+oceanBasis*slope);
        vec3 v=normalize(oceanView),sun=normalize(vec3(-.45,.6,1.));
        float light=clamp(dot(n,sun)/sun.z,0.,1.);
        float shade=mix(1.-planetShade,1.,light);
        float edge=pow(1.-max(dot(n,v),0.),3.);
        float reflection=max(dot(n,normalize(sun+v)),0.);
        float glitter=pow(reflection,32.)*.035;
        float swell=(sin(wa)+sin(wb)*.6+sin(wc)*.4)/2.;
        float ripple=smoothstep(.73,.96,swell)*.025;
        vec3 color=seaColor*shade*(1.-edge*.18)+vec3(glitter+ripple);
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`
  });


  const layer=new Globe.Group();layer.name='Translucent atmospheric clouds';globe.add(layer);
  const cloudMap=new Globe.TextureLoader().load('/globe-atmosphere/earth-clouds.png');
  cloudMap.wrapS=Globe.RepeatWrapping;cloudMap.anisotropy=4;
  const cloudShader={
    vertexShader:`
      varying vec3 cloudPoint; varying vec3 cloudNormal; varying vec3 cloudView;
      void main(){
        cloudPoint=normalize(position);cloudNormal=normalize(normalMatrix*normal);
        vec4 p=modelViewMatrix*vec4(position,1.);cloudView=-p.xyz;
        gl_Position=projectionMatrix*p;
      }`,
    fragmentShader:`
      uniform float opacity;uniform float shadow;uniform sampler2D cloudMap;
      varying vec3 cloudPoint;varying vec3 cloudNormal;varying vec3 cloudView;
      void main(){
        vec3 p=normalize(cloudPoint);
        vec2 uv=vec2(atan(p.z,p.x)/6.2831853+.5,asin(clamp(p.y,-1.,1.))/3.14159265+.5);
        float coverage=texture2D(cloudMap,uv).a;
        vec3 n=normalize(cloudNormal),v=normalize(cloudView);
        float facing=max(dot(n,v),0.);
        float alpha=coverage*opacity*smoothstep(.035,.30,facing);
        if(alpha<.002)discard;
        vec3 sun=normalize(vec3(-.45,.6,1.));float light=clamp(dot(n,sun)/sun.z,0.,1.);
        vec3 color=mix(vec3(.65,.78,.88),vec3(1.,.99,.97),light);
        if(shadow>.5)color=vec3(.02,.06,.08);
        gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`
  };
  const material=new Globe.ShaderMaterial({...cloudShader,uniforms:{cloudMap:{value:cloudMap},opacity:{value:.55},shadow:{value:0}},transparent:true,depthWrite:false});
  const cloudGeometry=new Globe.SphereGeometry(1,96,64);
  const clouds=new Globe.Mesh(cloudGeometry,material);clouds.scale.setScalar(1.010);clouds.name='Wispy cloud atmosphere';layer.add(clouds);
  const shadowMaterial=new Globe.ShaderMaterial({...cloudShader,uniforms:{cloudMap:{value:cloudMap},opacity:{value:.075},shadow:{value:1}},transparent:true,depthWrite:false});
  const shadows=new Globe.Mesh(cloudGeometry,shadowMaterial);shadows.scale.setScalar(1.0015);shadows.name='Atmospheric cloud shadows';layer.add(shadows);
  let last=-Infinity,previousFade=-1;
  return {water,cloudCount:1,get phase(){return time.value;},destroy(){cloudMap.dispose();},
    update(t,distance,reduced=false){
      const fade=smoothstep(distance,1.7,3.1),changed=Math.abs(fade-previousFade)>.001;
      if(changed){previousFade=fade;layer.visible=fade>.001;material.uniforms.opacity.value=fade*.55;shadowMaterial.uniforms.opacity.value=fade*.075;}
      const interval=distance>1.8?1/30:1/15;
      if(t-last<interval-.0005)return changed;
      if(reduced&&last!==-Infinity)return changed;
      last=t;time.value=reduced?0:t;layer.rotation.y=reduced?0:t*.003;
      return true;
    }
  };
}
