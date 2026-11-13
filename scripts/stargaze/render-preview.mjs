import {createCanvas} from '@napi-rs/canvas';
import {mkdir,writeFile} from 'node:fs/promises';
import {harness} from './render-harness.mjs';
const h=harness({width:960,height:960});
try {
  const ownX=parseFloat(h.tag.style.left),ownY=parseFloat(h.tag.style.top)+h.tag.offsetHeight/2+Math.max(19,Math.min(37,h.canvas.width*.036))+12;
  for(const type of ['pointerdown','pointerup']) h.send(type,{pointerId:1,button:0,clientX:h.canvas.width-ownX,clientY:h.canvas.height-ownY});
  const out=createCanvas(1536,1000),ctx=out.getContext('2d'),s=h.canvas.width,x=(1536-s)/2,y=(1000-s)/2;
  ctx.fillStyle='#0c1412';ctx.fillRect(0,0,1536,1000);
  for(const [r,fill] of [[s/2+17,'#376878'],[s/2+11,'#39472d'],[s/2+8,'#fff0c7'],[s/2+2,'#39472d']]){
    ctx.beginPath();ctx.arc(768,500,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
  }
  ctx.save();ctx.beginPath();ctx.arc(768,500,s/2,0,Math.PI*2);ctx.clip();ctx.drawImage(h.canvas,x,y);
  for(const label of [h.tag,h.nameTag]) if(!label.hidden) {
    const tx=x+parseFloat(label.style.left),ty=y+parseFloat(label.style.top),w=label.offsetWidth,hh=label.offsetHeight;
    ctx.fillStyle='#fff0c7';ctx.strokeStyle='#5a6242';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(tx-w/2,ty-hh/2,w,hh,12);ctx.fill();ctx.stroke();
    ctx.fillStyle='#39472d';ctx.font='600 14px Trebuchet MS';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label.textContent,tx,ty);
  }
  ctx.restore();ctx.textBaseline='alphabetic';
  ctx.textAlign='left';ctx.fillStyle='#fff0c7';ctx.font='bold 32px Trebuchet MS';ctx.fillText('30,088 stars',36,63);
  ctx.fillStyle='#ffd17a';ctx.font='bold 24px Trebuchet MS';ctx.fillText('2 online',38,101);
  ctx.strokeStyle='#fff0c7';ctx.lineCap='round';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(1474,39);ctx.lineTo(1493,58);ctx.moveTo(1493,39);ctx.lineTo(1474,58);ctx.stroke();
  await mkdir(new URL('../../review/stargaze/',import.meta.url),{recursive:true});
  await writeFile(new URL('../../review/stargaze/renderer-preview.png',import.meta.url),out.toBuffer('image/png'));
  console.log('Rendered production canvas to review/stargaze/renderer-preview.png');
}finally{h.dispose();}
