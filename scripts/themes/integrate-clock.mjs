import {readFileSync,writeFileSync} from 'node:fs';
const dir='public/pixi-art/themes/neon/centre/',read=p=>JSON.parse(readFileSync(p));
let svg=readFileSync(dir+'tower-body.svg','utf8');
svg=svg.replace(/<path d="M(?:232|413) 466[^>]*stroke="#704D24"[^>]*\/>/g,'');
writeFileSync(dir+'tower-body.svg',svg);
const centre=read(dir+'centre.json'),art=read('public/pixi-art/themes/neon/art.json');
const body=art.props.find(p=>p.src==='centre/tower-body.svg');
for(const [side,cx]of [['left',232],['right',413]]) for(const [hand,length,period]of [['hour',22,43200],['minute',34,3600]]) {
 const id=`clock-${side}-${hand}`,file=id+'.svg',w=80,h=80,x=-235.65+cx*471.3/643,y=-820+505*900/1228;
 writeFileSync(dir+file,`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M40 40 V${40-length}" stroke="#704D24" stroke-width="3.8" stroke-linecap="round"/><circle cx="40" cy="40" r="2.8" fill="#F0BA48" stroke="#704D24" stroke-width="1.7"/></svg>`);
 const piece={id,file,x:x-w/2,y:y-h/2,width:w,height:h,anchor:{x:.5,y:.5},at:[x,y],sortY:32.01,layer:'anim',animate:{kind:'rotate',period}};
 centre.pieces=centre.pieces.filter(p=>p.id!==id);centre.pieces.push(piece);
 const originX=body.x,originY=body.y-32;
 art.props=art.props.filter(p=>p.id!==id);art.props.push({id,name:`Clock ${side} ${hand}`,src:'centre/'+file,x:originX+x,y:originY+32.01,width:w,height:h,scale:1,anchor:{x:.5,y:(32.01-piece.y)/h},sortY:originY+32.01,shadow:false,wind:false,deck:false,centrePiece:piece});
}
writeFileSync(dir+'centre.json',JSON.stringify(centre,null,2)+'\n');writeFileSync('public/pixi-art/themes/neon/art.json',JSON.stringify(art,null,2)+'\n');
