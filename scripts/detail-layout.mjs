// The same deterministic packing plan is used by prerendered detail sheets.
export function packDetailFrames(pieces,limit=2048,budget=Infinity) {
  const sheets=[],aliases=new Map();
  for(const p of [...pieces].sort((a,b)=>Math.max(b.f.width,b.f.height)-Math.max(a.f.width,a.f.height)||a.src.localeCompare(b.src))){
    const identity=p.f.empty?'empty':JSON.stringify([p.drawing,p.viewBox,p.w,p.h,p.scale,p.padding,p.f,p.ground]);
    const same=aliases.get(identity);
    if(same){same.sheet.frames.push({...p,x:same.x,y:same.y,alias:true});continue;}
    const w=p.f.width+4,h=p.f.height+4;
    if(w>4096||h>4096){
      if(p.f.width>8192||p.f.height>8192)throw Error('Detail piece exceeds texture limit');
      const sheet={ground:p.ground,free:[],width:p.f.width,height:p.f.height,frames:[{...p,x:0,y:0}]};
      sheets.push(sheet);aliases.set(identity,{sheet,x:0,y:0});continue;
    }
    let best;
    for(const sheet of sheets)if(sheet.ground===p.ground)for(const [i,r]of sheet.free.entries())if(w<=r.w&&h<=r.h){
      const score=r.w*r.h-w*h;if(!best||score<best.score)best={sheet,i,r,score};
    }
    if(!best){const side=Math.max(limit,w,h),sheet={ground:p.ground,free:[{x:0,y:0,w:side,h:side}],frames:[],width:0,height:0};sheets.push(sheet);best={sheet,i:0,r:sheet.free[0]};}
    const {sheet,i,r}=best;sheet.free.splice(i,1);
    if(r.w-w>r.h-h){if(r.w>w)sheet.free.push({x:r.x+w,y:r.y,w:r.w-w,h:r.h});if(r.h>h)sheet.free.push({x:r.x,y:r.y+h,w,h:r.h-h});}
    else{if(r.w>w)sheet.free.push({x:r.x+w,y:r.y,w:r.w-w,h});if(r.h>h)sheet.free.push({x:r.x,y:r.y+h,w:r.w,h:r.h-h});}
    aliases.set(identity,{sheet,x:r.x+2,y:r.y+2});
    sheet.frames.push({...p,x:r.x+2,y:r.y+2});sheet.width=Math.max(sheet.width,r.x+w);sheet.height=Math.max(sheet.height,r.y+h);
  }
  const packed=sheets.map(({free,...s})=>s);
  if(detailSheetBytes(packed)<=budget)return packed;
  // A budget-fitted main plan may leave no room for atlas fragmentation.
  // Single-frame sheets need no gutter: texture edge clamping supplies it.
  const tight=[],unique=new Map();
  for(const p of pieces){
    const key=p.f.empty?'empty':JSON.stringify([p.drawing,p.viewBox,p.w,p.h,p.scale,p.padding,p.f,p.ground]);
    const same=unique.get(key);
    if(same){same.frames.push({...p,x:0,y:0,alias:true});continue;}
    if(p.f.width>8192||p.f.height>8192)throw Error('Detail piece exceeds texture limit');
    const sheet={ground:p.ground,width:p.f.width,height:p.f.height,frames:[{...p,x:0,y:0}]};
    tight.push(sheet);unique.set(key,sheet);
  }
  return tight;
}
export const detailSheetBytes=sheets=>sheets.reduce((n,s)=>n+s.width*s.height*4*(s.ground?1:4/3),0);
