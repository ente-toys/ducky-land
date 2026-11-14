import {Rectangle, Sprite, Texture} from 'pixi.js';

// A sheet frame is in sheet pixels, while orig/trim retain authored units.
export function sliceCentreTexture(texture,y,height) {
  const frame=texture.frame,ink=texture.trim??new Rectangle(0,0,texture.width,texture.height);
  const top=y*texture.height,bottom=(y+height)*texture.height;
  const first=Math.max(top,ink.y),last=Math.max(first,Math.min(bottom,ink.y+ink.height));
  const ratio=frame.height/ink.height;
  const result=new Texture({source:texture.source,dynamic:true,
    frame:new Rectangle(frame.x,frame.y+(first-ink.y)*ratio,frame.width,(last-first)*ratio),
    orig:new Rectangle(0,0,texture.width,texture.height*height),
    trim:new Rectangle(ink.x,first-top,ink.width,last-first)});
  (texture.artViews??=new Set()).add({texture:result,y,height});
  return result;
}

export function animatePieces(records, seconds, reduced = false) {
  for (const {piece, sprite:s, flip=false} of records) {
    const a=piece.animate;
    if (!a || !s.visible) continue;
    const b=s.centreRest ??= {x:s.x,y:s.y,sx:s.scale.x,sy:s.scale.y};
    s.position.set(b.x,b.y);s.scale.set(b.sx,b.sy);s.rotation=0;s.alpha=1;
    if(reduced) continue;
    const u=((seconds/(a.period??2.6)+(a.phase??0))%1+1)%1;
    let sx=1,sy=1,angle=0,dy=0;
    if(a.kind==='rotate') angle=seconds/a.period*Math.PI*2;
    if(a.kind==='spin') {
      const turn=seconds/(a.period??2.2)+(a.phase??0);
      const facing=Math.cos(turn*Math.PI*2);
      sx=(facing<0?-1:1)*(.6+.4*facing*facing);
      dy=-2.5*(1-Math.cos(turn*Math.PI*4))/2;
    }
    if(a.kind==='wind') sy=Math.cos(seconds/1.6*Math.PI*2);
    if(a.kind==='jet') sy=.96+.04*Math.sin(seconds*3);
    if(a.kind==='flow') {dy=u*a.travel;s.alpha=Math.min(1,u*7,(1-u)*7)*.82;}
    if(a.kind==='ripple') {sx=sy=.82+.32*u;s.alpha=Math.sin(Math.PI*u)*.8;}
    if(a.kind==='foam') {dy=Math.sin(u*Math.PI*2)*2;s.alpha=.92+.08*Math.cos(u*Math.PI*2);}
    const pivot=a.pivot ? [(a.pivot[0]-piece.x)/piece.width,(a.pivot[1]-piece.y)/piece.height] : [piece.anchor?.x??.5,piece.anchor?.y??1];
    const px=(pivot[0]-s.anchor.x)*s.texture.width*b.sx;
    const py=(pivot[1]-s.anchor.y)*s.texture.height*b.sy;
    const cos=Math.cos(angle),sin=Math.sin(angle);
    s.scale.set(b.sx*sx,b.sy*sy);s.rotation=angle;
    s.position.set(b.x+px-(px*sx*cos-py*sy*sin),b.y+py-(px*sx*sin+py*sy*cos)+dy*Math.abs(b.sy)*s.texture.height/piece.height);
  }
}

export async function attachCentreMotion(art, objects) {
  const textureViews=[];
  if(art.id==='pink' && !art.props.some(p=>p.centrePiece?.id==='dancer-stand')) {
    const dancer=art.props.find(p=>p.centrePiece?.id==='dancer' && p.src?.endsWith('centre/dancer.svg'));
    if(dancer) {
      const s=dancer.sprite,texture=s.texture,cut=842/1145;
      const view=(y,h)=>{
        const t=sliceCentreTexture(texture,y,h);
        textureViews.push(t);return t;
      };
      const stand=new Sprite(view(cut,1-cut));
      stand.anchor.set(s.anchor.x,(s.anchor.y-cut)/(1-cut));
      stand.position.copyFrom(s.position);stand.scale.copyFrom(s.scale);
      stand.zIndex=s.zIndex-.000001;stand.standing=s.standing;
      stand.visible=s.visible;stand.themeArt=s.themeArt;
      art.props.push({...dancer,id:'centre-dancer-stand',name:'Centre dancer stand',
        height:dancer.height*(1-cut),anchor:{x:stand.anchor.x,y:stand.anchor.y},
        centrePiece:{id:'dancer-stand',parent:'music-box',drawAbove:'music-box'},sprite:stand});
      objects.addChild(stand);
      const anchorY=s.anchor.y/cut,sx=s.scale.x,sy=s.scale.y;
      s.texture=view(0,cut);s.anchor.y=anchorY;s.scale.set(sx,sy);
      dancer.height*=cut;dancer.anchor={x:s.anchor.x,y:anchorY};
    }
  }
  const records=art.props.filter(p=>p.centrePiece?.animate && !['pour','fire'].includes(p.centrePiece.animate.kind)
    && !(art.id==='library' && p.centrePiece.animate.kind==='jet'))
    .map(p=>({piece:p.centrePiece,sprite:p.sprite,flip:p.flip}));
  let fire=null,pond=null;
  if(art.id==='community') {
    fire=(await import('./centre-motion/community.js')).updateCommunityCentre;
  }
  if(art.id==='library') {
    pond=(await import('./centre-motion/library.js')).createLibraryFountain(art,objects);
    for(const root of pond?.roots??[]) {
      root.visible=false;
      if(root.parent===objects)art.groups.push(root);
    }
  }
  art.updateCentre=(t,reduced)=>{animatePieces(records,t,reduced);fire?.(art,t,reduced);pond?.update(t,reduced,art.ground.visible);};
  const destroy=art.destroy.bind(art);
  art.destroy=()=>{pond?.destroy();destroy();textureViews.forEach(t=>t.destroy(false));};
}
