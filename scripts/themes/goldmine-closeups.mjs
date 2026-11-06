// Fixed .8 world scale source renders, never enlarged crops of the whole-island preview.
import sharp from 'sharp';
const A='../concepts/themes/work/goldmine/';const k=.8,ww=1000,hh=800;
const pairs=[['Plaza and locked landmark',2820,2370,4100,2660],['Curved bench ring',2820,2720,4090,3430],['Path junction',2400,2950,3050,3800],['Tree cluster',2050,2040,2670,2900]];
const comps=[];
for(let i=0;i<pairs.length;i++){
 const [label,hx,hy,gx,gy]=pairs[i];
 for(const [col,file,x,y]of [[0,'goldmine-home-reference.png',hx,hy],[1,'goldmine-gamezoom.png',gx,gy]]){
  const buf=await sharp(A+file).extract({left:Math.round(x*k-ww/2),top:Math.round(y*k-hh/2),width:ww,height:hh}).png().toBuffer();
  comps.push({input:buf,left:col*(ww+20)+20,top:70+i*(hh+50)});
 }
 const text=Buffer.from(`<svg width="${ww*2+60}" height="40"><text x="20" y="29" font-family="Arial" font-size="22" fill="#39472D">${label} | HOME (left), GOLDMINE (right) | identical 0.8 scale</text></svg>`);
 comps.push({input:text,left:0,top:30+i*(hh+50)});
}
await sharp({create:{width:ww*2+60,height:70+pairs.length*(hh+50),channels:4,background:'#fff3cf'}}).composite(comps).png().toFile(A+'goldmine-closeups-vs-home.png');
if(process.argv[2])await sharp(A+'goldmine-closeups-vs-home.png').png().toFile(A+`goldmine-round-${process.argv[2]}-closeups-vs-home.png`);
console.log('Saved fixed-scale plaza, arc bench, path junction and grove comparison');
