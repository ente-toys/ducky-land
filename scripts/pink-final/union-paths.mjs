import {centreClip,inCentre} from './centre-lock.mjs';
import {Path2D,PathOp,StrokeCap,StrokeJoin} from '@napi-rs/canvas';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
execFileSync('python3',['scripts/pink-final/union-inputs.py'],{stdio:'inherit'});
const read=p=>JSON.parse(readFileSync(p)),A='public/pixi-art/themes/pink/',input=read('scripts/pink-final/union-inputs.json'),art=read(A+'art.json');
const matrix=m=>({a:m[0],b:m[1],c:m[2],d:m[3],e:m[4],f:m[5]});
function shape(s){let p=new Path2D();if(s.kind==='path')p=new Path2D(s.d);else if(s.kind==='ellipse')p.ellipse(s.cx,s.cy,s.rx,s.ry,0,0,Math.PI*2);else p.roundRect(s.x,s.y,s.width,s.height,s.rx);p=p.transform(matrix(s.matrix));if(s.stroke)p=new Path2D(p).stroke({width:s.stroke,cap:StrokeCap.Round,join:StrokeJoin.Round});return p;}
const pieces=input.pieces.map(s=>({...s,path:shape(s)}));let all=new Path2D(),roads=new Path2D();
for(const s of pieces){all=all.op(s.path,PathOp.Union);if(s.stroke)roads=roads.op(s.path,PathOp.Union);}
const coastD=readFileSync('scripts/pink-fix/art/coast.svg','utf8').match(/ d="([^"]+)"/)[1];all=all.op(new Path2D(coastD),PathOp.Intersect).simplify();
const d=all.toSVGString();if(!d||/nan|infinity/i.test(d))throw Error('Invalid merged floor geometry');
const body=`<defs><clipPath id="outside-locked-centre"><path clip-rule="evenodd" d="M-3000 -2200H11000V8200H-3000Z M4930 2850A930 760 0 1 0 3070 2850A930 760 0 1 0 4930 2850Z"/></clipPath></defs><g clip-path="url(#outside-locked-centre)" data-floor-union="true" fill-rule="evenodd"><path d="${d}" fill="#FBE6C8"/></g>`;
const root=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2600 -1900 13200 9800">${body}</svg>`;
mkdirSync(A+'expansion/merged',{recursive:true});writeFileSync(A+'expansion/merged/unified-paths.svg',root);
const corridors=new Path2D(roads).op(new Path2D(roads).stroke({width:28,cap:StrokeCap.Round,join:StrokeJoin.Round}),PathOp.Union);
for(const decor of input.decorations){
 const p=decor.prop,floor=shape(decor.shape),rim=new Path2D(floor).stroke({width:64,cap:StrokeCap.Round,join:StrokeJoin.Round});let mask=new Path2D(floor).op(rim,PathOp.Difference).op(corridors,PathOp.Difference);
 const [a,b,c,e,tx,ty]=decor.matrix,det=a*e-b*c;mask=mask.transform({a:e/det,b:-b/det,c:-c/det,d:a/det,e:(c*ty-e*tx)/det,f:(b*tx-a*ty)/det});
 let source=readFileSync(A+p.src,'utf8'),content=source.replace(/^.*?<svg\b[^>]*>/s,'').replace(/<\/svg>\s*$/,'');const open=source.match(/<svg\b[^>]*>/)[0];
 const src='expansion/merged/floor-detail-'+p.id+'.svg';writeFileSync(A+src,open+`<defs><clipPath id="joined-floor-detail" clipPathUnits="userSpaceOnUse"><path d="${mask.toSVGString()}" clip-rule="evenodd" fill-rule="evenodd"/></clipPath></defs><g clip-path="url(#joined-floor-detail)">${content}</g></svg>`);
 const flat=art.flats.find(f=>f.id===p.id);flat.src=src;
}
art.flats=art.flats.filter(p=>!(p.src.startsWith('hamlets/')&&/\/paths/.test(p.src)));
const shore=readFileSync('scripts/pink-fix/art/shore.svg','utf8').replace(/<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'');
const source=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2600 -1900 13200 9800"><defs><path id="pink-coast" d="${coastD}"/></defs>${body}${shore}</svg>`;
writeFileSync(A+'expansion/shore/shore-source.svg',source);
for(const t of art.ground.tiles.filter(t=>t.src.startsWith('expansion/shore/')))writeFileSync(A+t.src,source.replace('viewBox="-2600 -1900 13200 9800"',`width="${t.width}" height="${t.height}" viewBox="${t.x} ${t.y} ${t.width} ${t.height}"`));
const joins=[];
for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++){
 const a=pieces[i],b=pieces[j];if(!a.stroke&&!b.stroke)continue;
 const intersection=new Path2D(a.path).op(b.path,PathOp.Intersect).toSVGString();
 for(const contour of intersection.match(/M[^M]+/g)??[]){
  const box=new Path2D(contour).computeTightBounds();const [x0,y0,x1,y1]=box;
  if(x1-x0<2||y1-y0<2)continue;const x=(x0+x1)/2,y=(y0+y1)/2;if(inCentre(x,y))continue;
  if(!joins.some(p=>Math.hypot(p.x-x,p.y-y)<100))joins.push({id:'join-'+String(joins.length+1).padStart(3,'0'),sources:[a.id,b.id],x,y,bounds:box});
 }

}
writeFileSync(A+'art.json',JSON.stringify(art,null,1)+'\n');
writeFileSync('scripts/pink-final/path-union-report.json',JSON.stringify({operation:'Skia PathOp.Union before any outline stroke',pieces:pieces.length,decorativeCourts:input.decorations.length,independentOutlineShapes:1,joins,bounds:all.computeTightBounds(),svgBytes:root.length},null,2)+'\n');
console.log('Unified',pieces.length,'floor pieces;',joins.length,'joins; one outside outline');
