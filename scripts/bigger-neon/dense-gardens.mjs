import fs from 'node:fs';
const ink='#625b76';
fs.writeFileSync('public/pixi-art/themes/neon/bigger/shared-well.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="210" height="240" viewBox="0 0 210 240" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="105" cy="223" rx="94" ry="15" fill="#718c42" opacity=".4"/><path d="M34 165H176V212Q105 248 34 212Z" fill="#c9bad5" stroke="${ink}" stroke-width="4"/><ellipse cx="105" cy="165" rx="71" ry="23" fill="#ffe9b2" stroke="${ink}" stroke-width="4"/><ellipse cx="105" cy="165" rx="48" ry="13" fill="#7abdc7"/><path d="M49 170V59M161 170V59" stroke="${ink}" stroke-width="10"/><path d="M19 67L105 15L191 67L177 87Q105 113 33 87Z" fill="#d894b2" stroke="${ink}" stroke-width="4"/><path d="M44 68L105 33L167 68M105 103V163" fill="none" stroke="#ffe9b2" stroke-width="5"/><path d="M90 156H120L116 182Q105 190 94 182Z" fill="#e1bf8f" stroke="${ink}" stroke-width="3"/><path d="M34 198Q105 230 176 198M72 184V209M131 184V209" fill="none" stroke="${ink}" stroke-width="3"/></svg>`);
export function denseGardens(layout,p){
 let ground='';
 for(const c of layout.communities)for(const [i,[x,y]]of c.homes.entries()){
  const w=[420,470,430,475,420,455,425][i];
  ground+=`<path d="M${x-w/2} ${y-35}Q${x} ${y-65} ${x+w/2} ${y-30}L${x+w/2} ${y+170}Q${x} ${y+210} ${x-w/2} ${y+170}Z" fill="#adc454" stroke="#8aa742" stroke-width="5"/>`;
  for(const sign of [-1,1]){const bx=x+sign*139;ground+=`<path d="M${bx-35} ${y+65}q35 -18 70 0v55q-35 18 -70 0Z" fill="#b9a16d" stroke="#847c4d" stroke-width="4"/>`;
   for(const dy of [72,92,112])ground+=`<path d="M${bx-21} ${y+dy}l9 -12 10 10 12 -15 12 13" fill="none" stroke="${c.id==='simmerwick'?'#ce88a9':c.id==='purrlumi'?'#689d65':'#7caa48'}" stroke-width="7"/>`;
  }
 }
 for(const [x,y,rx,ry,color]of [[-1120,680,240,120,'#dca4c3'],[-650,640,220,130,'#eac373'],[-940,1080,140,100,'#c5acd7'],[2630,-1010,220,120,'#8ab45d'],[3050,-1110,190,110,'#8ab45d'],[8450,1050,260,140,'#77a66b'],[8870,1200,180,135,'#82ad68'],[1950,5640,220,110,'#94b35b'],[1770,5880,210,100,'#98b85b']]){
  ground+=`<ellipse cx="${x}" cy="${y}" rx="${rx+30}" ry="${ry+25}" fill="#aac24d"/><path d="M${x-rx} ${y-ry*.6}Q${x} ${y-ry*1.3} ${x+rx} ${y-ry*.6}L${x+rx} ${y+ry*.7}Q${x} ${y+ry*1.3} ${x-rx} ${y+ry*.7}Z" fill="#b6a173" stroke="#7f8f48" stroke-width="5"/>`;
  for(const dy of [-.45,0,.45])ground+=`<path d="M${x-rx*.8} ${y+ry*dy}q${rx*.8} -25 ${rx*1.6} 0" fill="none" stroke="${color}" stroke-width="25" stroke-dasharray="12 13"/>`;
 }
 for(const [src,x,y,s]of [['reuse/tree-4.svg',2270,-1060,1],['reuse/tree-1.svg',2760,-1190,.85],['reuse/tree-2.svg',3230,-1190,.85],['reuse/tree-4.svg',4620,-1020,.9],['reuse/tree-5.svg',5100,-800,.85],['reuse/tree-3.svg',8550,950,.9],['reuse/tree-1.svg',8930,1150,.85],['reuse/tree-5.svg',8720,3830,.9],['reuse/tree-2.svg',1800,5440,.85],['reuse/tree-4.svg',1590,5880,.85],['reuse/tree-3.svg',2180,6090,.9],['bigger/noodle-rack.svg',-990,970,.7],['bigger/workbench.svg',2860,-930,.7],['bigger/book-rack.svg',8770,3590,.7],['reuse/neon-crate.svg',2130,5670,.8]])p(src,x,y,s);
 return ground;
}
