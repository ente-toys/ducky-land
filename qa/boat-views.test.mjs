import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {Assets, Sprite, Texture, TextureSource} from 'pixi.js';
import {loadBoatViews} from '../src/rendering/pixi/boat-views.js';
import sharp from 'sharp';

const base = new URL('../public/pixi-art/boat/', import.meta.url);
const frames = JSON.parse(readFileSync(new URL('spin/frames.json', base)));
const manifest = JSON.parse(readFileSync(new URL('views.json', base)));
const wrap = deg => Math.atan2(Math.sin(deg*Math.PI/180), Math.cos(deg*Math.PI/180))*180/Math.PI;

test('rear 33-40 mast length and deck projection remain continuous through 38-39',async()=>{
  let previous;
  for(let n=33;n<=40;n++){
    const v=manifest.views[`f${String(n).padStart(2,'0')}`];
    const source=readFileSync(new URL(v.file,base),'utf8');
    assert.match(source,/data-part="mast" data-top="112" data-foot="400"/);
    assert.doesNotMatch(source,/scale\(1 \.4\)/);
    const footY=(400-manifest.anchor[1]*560)*manifest.width/640-v.seat[1];
    assert.ok(footY < -8 && footY > -15,`view ${n}: ${footY}`);
    if(previous){assert.ok(Math.abs(footY-previous.y)<.4);assert.ok(Math.abs(v.seat[0]-previous.x)<6);}
    previous={x:v.seat[0],y:footY};
    const [src,front]=await Promise.all([v.file,v.front].map(file=>sharp(readFileSync(new URL(file,base))).ensureAlpha().raw().toBuffer()));
    for(const [x,y]of [[316,180],[316,386],[316,398]]){
      const i=(y*640+x)*4;
      assert.equal(src[i+3],255);assert.deepEqual(front.subarray(i,i+4),src.subarray(i,i+4),'foreground follows the full-length mast');
    }
  }
});

test('flag reversal passes through narrow signed-width intermediates',async()=>{
  for(const [n,width]of [[18,58],[19,9],[20,-9],[21,-58],[43,-58],[44,-9],[45,9],[46,58]]){
    const v=manifest.views[`f${String(n).padStart(2,'0')}`];
    const svg=readFileSync(new URL(v.file,base),'utf8');
    assert.match(svg,new RegExp(`data-part="flag" data-width="${width.toFixed(3)}"`));
    if(Math.abs(width)>9)continue;
    const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let orange=0;
    for(let y=90;y<240;y++)for(let x=0;x<info.width;x++){
      const i=(y*info.width+x)*4;
      if(data[i]>225&&data[i+1]<155&&data[i]-data[i+1]>95&&data[i+2]<100&&data[i+3]>100)orange++;
    }
    assert.ok(orange<300,`view ${n}: broad old flag was removed (${orange} orange pixels)`);
  }
});

test('combined rear foreground retains exact mast/sail pixels, with front-view mast behind rider', async () => {
  for(const n of [12,30,36,38]) {
    const v=manifest.views[`f${String(n).padStart(2,'0')}`];
    const [source,cut]=await Promise.all([v.file,v.front].map(file=>sharp(readFileSync(new URL(file,base))).ensureAlpha().raw().toBuffer()));
    const pixel=(a,x,y)=>[...a.subarray((y*640+x)*4,(y*640+x)*4+4)];
    if(n>=24){for(const [x,y] of [[316,180],[316,300]])assert.deepEqual(pixel(cut,x,y),pixel(source,x,y));}
    else assert.equal(pixel(cut,316,180)[3],0,'front-view mast stays behind rider');
  }
});

test('bow silhouette coverage continues through 04/05 and 19/20 without a sector cutoff', async () => {
  for(const n of [4,5,19,20]) {
    const v=manifest.views[`f${String(n).padStart(2,'0')}`];
    const [source,cut]=await Promise.all([v.file,v.front].map(file=>sharp(readFileSync(new URL(file,base))).ensureAlpha().raw().toBuffer()));
    let beakPixels=0;
    for(let y=250;y<430;y++)for(let x=0;x<640;x++){
      const i=(y*640+x)*4;
      if(source[i]>225 && source[i+1]<140 && source[i+2]<90 && source[i+3]===255){
        beakPixels++;assert.equal(cut[i+3],255,`view ${n}: real bow beak covers the rider`);
      }
    }
    assert.ok(beakPixels>20,`view ${n}: exercised its real bow silhouette`);
  }
});

test('48 boat sectors cover a full turn and point to complete SVG artwork and seat metadata', () => {
  assert.equal(frames.frames.length, 48);
  assert.equal(Object.keys(manifest.views).length, 48);
  assert.deepEqual(frames.canvas, [640,560]);
  assert.equal(frames.hullBottomY, 512);
  assert.deepEqual(manifest.anchor, frames.anchor);
  assert.equal(manifest.width, frames.drawWidth);
  assert.equal(readdirSync(new URL('spin/',base)).filter(f=>/^boat-\d+\.svg$/.test(f)).length,48);
  assert.equal(readdirSync(new URL('spin/',base)).some(f=>f.endsWith('.png')),false);
  for (const [n,frame] of frames.frames.entries()) {
    const view = manifest.views[`f${String(n).padStart(2,'0')}`];
    assert.equal(frame.deg,90-7.5*n);
    assert.ok(Math.abs(Math.abs(wrap(frame.deg-frames.frames[(n+1)%48].deg))-7.5)<1e-10);
    assert.deepEqual(view.seat,frame.riderSeat ?? frame.seat);
    assert.equal(view.file,frame.file);
    assert.equal(view.deg,frame.deg);
    assert.ok(view.seat.every(Number.isFinite));
    assert.ok(Math.abs(view.seat[0])<100 && view.seat[1]<0 && view.seat[1]>-120);
    const svg=readFileSync(new URL(view.file,base),'utf8');
    assert.match(svg,/viewBox="0 0 640 560"/);
    assert.match(svg,/<path /);
    assert.doesNotMatch(svg,/<image\b/);
    if (view.front) {
      const front=readFileSync(new URL(view.front,base),'utf8');
      assert.match(front,/<clipPath id="front"/);
      assert.match(front,/clip-path="url\(#front\)"/);
    }
  }
  assert.equal(Object.values(manifest.views).filter(v=>v.front).length,48);
});

test('boat selection traverses all 48 views, holds a noisy boundary, and wraps across north', async () => {
  const originalFetch=globalThis.fetch, originalLoad=Assets.load;
  const requested=[];
  globalThis.fetch=async()=>({ok:true,json:async()=>manifest});
  Assets.load=async request=>{
    requested.push(request.src);
    return new Texture({source:new TextureSource({width:640,height:560})});
  };
  try {
    const bank=await loadBoatViews();
    assert.equal(bank.views.length,48);
    assert.equal(requested.length,96);
    let current;
    for(let n=0;n<=96;n++) {
      const view=bank.pick((90-n*7.5)*Math.PI/180,current);
      assert.equal(view.key,`f${String(n%48).padStart(2,'0')}`);
      current=view.key;
    }
    assert.equal(bank.pick(4.9*Math.PI/180,'f12').key,'f12');
    assert.equal(bank.pick(5.3*Math.PI/180,'f12').key,'f11');
    assert.equal(bank.pick(-177.4*Math.PI/180,'f35').key,'f35');
    assert.equal(bank.pick(-177.8*Math.PI/180,'f35').key,'f36');
    assert.equal(bank.pick(179.9*Math.PI/180,'f36').key,'f36');
    assert.equal(bank.pick(-179.9*Math.PI/180,'f36').key,'f36');
    const sprite=new Sprite();bank.apply(sprite,bank.byKey.get('f12'));
    assert.equal(sprite.width,manifest.width);
    assert.equal(sprite.anchor.x,manifest.anchor[0]);
    assert.equal(sprite.anchor.y,manifest.anchor[1]);
    sprite.destroy();
    for(const view of bank.views){view.texture.destroy(true);view.front?.destroy(true);view.rigFront?.destroy(true);}
  } finally {globalThis.fetch=originalFetch;Assets.load=originalLoad;}
});
