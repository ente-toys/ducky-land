import {readFileSync,writeFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {ISLETS,ISLET_META} from '../../src/pixi/islets.js';
const NS='http://www.w3.org/2000/svg',parse=s=>new DOMParser().parseFromString(s,'image/svg+xml');
const S={ns:[[120,312],[120,53]],ew:[[32,168],[448,168]],ne:[[90,296],[395,104]],nw:[[395,296],[85,104]]};
const composition=JSON.parse(readFileSync('scripts/world-layout/islet-composition.json'));
for(const i of ISLETS){
 const meta=structuredClone(ISLET_META[i.art]),k=i.width/1024;
 const doc=parse(readFileSync(`public/pixi-art/islets/${i.art}.svg`,'utf8')),root=doc.documentElement;
 for(const n of Array.from(root.getElementsByTagName('*')).filter(n=>['jetty','dock-landing'].includes(n.getAttribute('id'))))n.parentNode.removeChild(n);
 const approach=composition[i.art].dockApproach,foot=approach?.foot??meta.jetty.foot,[ox,oy]=meta.jetty.tip;
 const heading=approach?approach.heading*Math.PI/180:Math.atan2(oy-foot[1],ox-foot[0]);
 const dx=Math.cos(heading),dy=Math.sin(heading),len=1;
 const tip=[foot[0]+dx/len*320/k,foot[1]+dy/len*320/k];
 const [a,b]=foot[1]>=tip[1]?[foot,tip]:[tip,foot],v=[b[0]-a[0],b[1]-a[1]];
 const dir=Math.abs(v[1])<Math.abs(v[0])*.25?'ew':Math.abs(v[0])<Math.abs(v[1])*.25?'ns':v[0]>0?'ne':'nw';
 const src=`public/pixi-art/home-expansion-c/bridges/bridge-${dir}.svg`,bridge=parse(readFileSync(src,'utf8'));
 let [n,f]=S[dir];if(dir==='ew'&&v[0]<0)[n,f]=[f,n];
 const u=[f[0]-n[0],f[1]-n[1]],cross=dir==='ew'?[0,1]:dir==='ns'?[1,0]:[1,dir==='ne'?.62:-.62];
 const depth=.62,gv=[v[0],v[1]/depth],sg=Math.sign(cross[0]*u[1]-cross[1]*u[0])||1;
 let q=[gv[1],-gv[0]*depth],ql=Math.hypot(q[0],q[1]/depth),cl=Math.hypot(cross[0],cross[1]/depth)/k;
 q=q.map(x=>x*cl/ql);if((q[0]*v[1]-q[1]*v[0])*sg<0)q=q.map(x=>-x);
 const det=u[0]*cross[1]-u[1]*cross[0];
 const A=(v[0]*cross[1]-q[0]*u[1])/det,C=(q[0]*u[0]-v[0]*cross[0])/det,B=(v[1]*cross[1]-q[1]*u[1])/det,D=(q[1]*u[0]-v[1]*cross[0])/det;
 const g=doc.createElementNS(NS,'g');g.setAttribute('id','jetty');g.setAttribute('data-home-source',src.replace('public',''));
 g.setAttribute('transform',`matrix(${[A,B,C,D,a[0]-A*n[0]-C*n[1],a[1]-B*n[0]-D*n[1]].join(' ')})`);
 for(const child of Array.from(bridge.documentElement.childNodes))if(child.nodeType===1&&!['title','desc'].includes(child.localName))g.appendChild(doc.importNode(child,true));
 const landing=doc.createElementNS(NS,'path');landing.setAttribute('id','dock-landing');
 landing.setAttribute('d',`M${foot[0]-dx*82/k} ${foot[1]-dy*82/k} L${foot[0]+dx*8/k} ${foot[1]+dy*8/k}`);
 landing.setAttribute('fill','none');landing.setAttribute('stroke','#fde48c');landing.setAttribute('stroke-width',String(128/k));landing.setAttribute('stroke-linecap','round');
 root.appendChild(landing);root.appendChild(g);
 // Preserve depth selection for the native Home tree replacements in the study.
 for(const [piece,point]of (i.art==='tree-and-rowboat'?[['oak',[503,553]]]:i.art==='04-small-mountain'?[['west-tree',[340,546]],['east-tree',[690,572]]]:[])){
  const node=Array.from(root.childNodes).find(n=>n.nodeType===1&&n.getAttribute('transform')?.startsWith(`translate(${point[0]- (piece==='oak'?245:piece==='west-tree'?112:106)/2}`));
  if(node)node.setAttribute('data-piece',piece);
 }
 // Native study plants are decorative, so retain original collision footprints.
 const text=new XMLSerializer().serializeToString(doc);
 if(/<(linearGradient|radialGradient|image|filter|pattern)\b/i.test(text))throw Error('Flat art only');
 writeFileSync(`public/pixi-art/islets/${i.art}.svg`,text);
 meta.jetty={...meta.jetty,foot,tip,width:112/k,homeSource:src.replace('public',''),worldLength:320,approachHeading:approach?.heading};
 writeFileSync(`public/pixi-art/islets/${i.art}.meta.json`,JSON.stringify(meta)+'\n');
}
console.log('11 islets use approved Home Honeywood bridges, independent of 3x land size.');
