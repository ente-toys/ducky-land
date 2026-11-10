import {readFileSync} from 'node:fs';
const ROOT='public/pixi-art/home-expansion-c/bridges/';
const fmt=v=>+v.toFixed(4);
// Exact deck surface centres after removing Home's raised bank-sill wrapper.
export const BRIDGE_SILLS={ns:[[120,310],[120,50]],ew:[[30,169.2],[450,169.2]],ne:[[91.5,292],[388.5,108]],nw:[[388.5,292],[91.5,108]]};
export function archBridge({a,b}){
 const [near,far]=a[1]>=b[1]?[a,b]:[b,a],v=far.map((x,i)=>x-near[i]);
 const dir=Math.abs(v[1])<1e-6?'ew':Math.abs(v[0])<1e-6?'ns':v[0]>0?'ne':'nw';
 let source=readFileSync(ROOT+'bridge-'+dir+'.svg','utf8');
 const [W,H]=source.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1).map(Number);
 let [n,f]=BRIDGE_SILLS[dir];if(dir==='ew'&&v[0]<0)[n,f]=[f,n];
 const u=f.map((x,i)=>x-n[i]);
 // Fair's crossings are square cardinal spans. Never shear a bridge to chase a path.
 // A diagonal must use its approved source bearing; a new bearing needs a landing remap.
 const sx=dir==='ns'?1:v[0]/u[0],sy=dir==='ew'?1:v[1]/u[1];
 if(dir!=='ns'&&dir!=='ew'&&Math.abs(sx-sy)>1e-5)throw Error('Bridge must use the Honeywood '+dir+' bearing');
 const x=near[0]-sx*n[0],y=near[1]-sy*n[1];
 let inner=source.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 const start=inner.indexOf('<g stroke='),head=inner.slice(0,start),body=inner.slice(start);
 const cut=body.indexOf('<!-- '+(dir==='ew'?'Far handrail':dir==='ns'?'The arch':'Back rail'));
 if(cut>0)inner=head+body.slice(0,body.indexOf('>')+1)+body.slice(cut);
 const box=[x-2,y-2,W*sx+4,H*sy+4];
 return {box,dir,crown:24*sy,squash:dir==='ew'?.62:undefined,transform:[sx,0,0,sy,x,y],
 svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(box[2])}" height="${fmt(box[3])}" viewBox="${box.map(fmt).join(' ')}"><g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(sx)} ${fmt(sy)})">${inner}</g></svg>`};
}
