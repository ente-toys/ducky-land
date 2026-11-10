// Cathedral/tower finishing and the source-of-truth segmented arcade pass.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {segmentedArcades} from './centre-arcade.mjs';
const A='public/pixi-art/themes/cathedral/';
const ink='#39472d',light='#FFF0C7',roof='#D9753D';
const P=(d,fill='none',stroke=ink,w=4.5)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
export function polishCentre(){
 const art=JSON.parse(fs.readFileSync(A+'art.json'));
 for(const id of ['cathedral-hall','campanile']){
  const p=art.props.find(p=>p.id===id);let s=fs.readFileSync(A+p.src,'utf8');
  s=s.replace(/stroke="#39472d" stroke-width="(?:3|2\.5)"/g,'stroke="#39472d" stroke-width="4.5"');
  if(id==='cathedral-hall'){
   // A stone socket joins the left eave, avoiding the former triangular flap.
   s=s.replace(/<g data-roof-abutment="left">[\s\S]*?<\/g>/,`<g data-roof-abutment="left">`+P('M30 752L58 739L72 748V790Z',roof)+P('M30 752L72 790V804L30 766Z',light)+'</g>');
  }else{
   // Broader cornice and a complete hip roof, safely inset inside its sheet.
   s=s.replace('M45 207L164 80L306 163L244 214Z','M35 202L164 64L303 153L244 214Z').replace('M45 207L164 80L244 214Z','M35 202L164 64L244 214Z');
   s=s.replace('M164 80L111 207 M164 80L184 210 M164 80L276 179','M164 64L101 202 M164 64L184 210 M164 64L276 172');
   s=s.replace('M41 207H245L309 163V180L247 229H47Z','M31 202H245L307 153V174L247 224H38Z');
   s=s.replace('cy="67"','cy="51"');
  }
  fs.writeFileSync(A+p.src,s);
 }
 segmentedArcades();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)polishCentre();
