import {THREE,P,group,sphere,torus,cone,extrude,box,line} from './primitives.js';
export function heart(g,color=P.red,s=1){const shape=new THREE.Shape();shape.moveTo(0,.1);shape.bezierCurveTo(-1,.65,-.7,1.4,0,.9);shape.bezierCurveTo(.7,1.4,1,.65,0,.1);const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:true,bevelSize:.045,bevelThickness:.045,bevelSegments:2,steps:1}),new THREE.MeshToonMaterial({color}));mesh.scale.setScalar(s);g.add(mesh);return mesh;}
function star(g,size,color){const pts=Array.from({length:10},(_,i)=>{const a=Math.PI/2+i*Math.PI/5,r=i%2?size*.45:size;return[Math.cos(a)*r,Math.sin(a)*r+size];});return extrude(g,pts,.12,color);}
function effect(n){const g=group();g.userData.motion='effect';if(n.startsWith('heart')){heart(g,n==='heart-pink'?P.pink:P.red,n==='heart-small'?.6:1);}
else if(n.startsWith('star'))star(g,n==='star-small'?.35:.6,P.yellow);
else if(n.startsWith('puff')){const count=n==='puff-small'?3:n==='puff-wide'?7:9;for(let i=0;i<count;i++)sphere(g,.2+(i%3)*.09,.25,.18,P.white,(i-count/2)*.2,.3+Math.sin(i)*.1,n==='puff-trail'?i*.09:0);}
else if(n.startsWith('splash')){const count=n==='splash-small'?5:n==='splash-wide'?10:8;for(let i=0;i<count;i++){const a=i/count*Math.PI*2;line(g,[[0,.06,0],[Math.cos(a)*.4,.6+(i%3)*.12,Math.sin(a)*.4],[Math.cos(a)*.8,.25,Math.sin(a)*.8]],.04,P.water);sphere(g,.05,.09,.05,P.blue,Math.cos(a)*.85,.4,Math.sin(a)*.85);}const t=torus(g,.5,.03,P.water,0,.08,0);t.rotation.x=Math.PI/2;}
else if(n==='droplet'){sphere(g,.22,.3,.22,P.water,0,.3,0);cone(g,.17,.35,P.water,0,.65,0);}
else if(n==='zzz'){for(let i=0;i<3;i++){const o=i*.35;line(g,[[-.2+o,.4+o,0],[.1+o,.4+o,0],[-.2+o,.1+o,0],[.1+o,.1+o,0]],.035,P.purple);}}
else if(n==='exclamation'){box(g,.13,.65,.13,P.orange,0,.65,0);sphere(g,.09,.09,.09,P.orange,0,.12,0);}
else if(n==='question'){line(g,[[-.22,.8,0],[-.1,1,0],[.2,.95,0],[.2,.7,0],[0,.5,0],[0,.35,0]],.065,P.purple);sphere(g,.085,.085,.085,P.purple,0,.1,0);}
else {sphere(g,n==='bubble-round'?.5:.7,.45,.14,P.white,0,.55,0);if(n==='bubble-thought'){sphere(g,.13,.12,.1,P.white,-.45,.12,0);sphere(g,.07,.065,.06,P.white,-.58,0,0);}else if(n!=='bubble-round')extrude(g,[[-.4,.3],[-.55,-.03],[-.1,.28]],.09,P.white,0,0,0);
if(n==='bubble-typing')for(let i=-1;i<2;i++)sphere(g,.065,.065,.03,P.ink,i*.23,.55,.15);
if(n==='bubble-quack'){sphere(g,.22,.22,.03,P.yellow,0,.55,.15);box(g,.2,.08,.04,P.orange,.2,.48,.18);sphere(g,.025,.025,.02,P.ink,.06,.6,.2);}}
return g;}
const names=['puff-small','puff-wide','puff-trail','splash-small','splash-wide','splash-crown','star-rounded','star-small','heart-red','heart-pink','heart-small','zzz','bubble-speech','bubble-round','bubble-thought','bubble-quack','bubble-typing','droplet','exclamation','question'];
export const fxFactories=Object.fromEntries(names.map(n=>[n,()=>effect(n)]));
