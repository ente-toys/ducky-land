import fs from 'node:fs';
const dir='public/pixi-art/themes/neon/bigger/';
const ink='#625b76';
const wrap=(w,h,b)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
export function communityArt(){
 const themes=[['lantern-house','#f2b3c7','#d982a8','#ffe4ac'],['clock-house','#9ddbd3','#75b7be','#e8ce96'],['book-house','#cbb7dc','#9c8dbb','#f8dca0'],['quay-house','#f3d49b','#d8a778','#9cd8d4']];
 for(const [index,[name,wall,roof,trim]]of themes.entries()){
  let b=`<ellipse cx="200" cy="447" rx="184" ry="18" fill="#6e863d" opacity=".35"/><g stroke="${ink}" stroke-width="4"><path d="M38 158H362V396Q200 446 38 396Z" fill="${wall}"/><path d="M39 160Q200 210 361 160V188Q200 240 39 188Z" fill="${trim}"/><path d="M28 104Q200 27 372 104L366 162Q200 215 34 162Z" fill="${roof}"/><ellipse cx="200" cy="104" rx="172" ry="49" fill="${trim}"/><path d="M66 96Q200 50 334 96M76 117Q201 77 324 117" fill="none" stroke="#fff2c8" stroke-width="6"/><path d="M300 77V28L338 25V82" fill="${wall}"/><ellipse cx="319" cy="27" rx="19" ry="7" fill="#8b8297"/><path d="M157 422V306Q200 272 243 306V422" fill="${roof}"/><path d="M172 414V313Q200 295 228 313V414" fill="#fff0c1"/><path d="M184 320H216V360H184Z" fill="#9cdbd7"/><circle cx="218" cy="382" r="4" fill="${ink}"/><path d="M140 427Q200 444 260 427L270 442Q200 460 130 442Z" fill="${trim}"/>`;
  for(const x of [67,267])b+=`<rect x="${x}" y="240" width="65" height="85" rx="20" fill="#98ccc9"/><path d="M${x+8} 275H${x+57}M${x+32} 244V316" stroke="#f4ffe5" stroke-width="5"/><path d="M${x-8} 324Q${x+32} 337 ${x+73} 324V344Q${x+32} 357 ${x-8} 344Z" fill="${roof}"/><path d="M${x+4} 323l5 -18 13 16 14 -23 11 24 14 -15 0 20" fill="#6eae68" stroke="#688158" stroke-width="3"/>`;
  // The roof crest and household work identify the residents without relying on labels.
  if(index===0)b+=`<path d="M161 141Q200 161 239 141L230 168Q200 185 170 168Z" fill="#fff0bd"/><path d="M183 131Q173 115 185 105M201 131Q190 115 202 103M219 131Q209 115 220 108" fill="none" stroke="#fff0bd" stroke-width="5"/><path d="M45 208Q200 254 355 208" fill="none"/><g fill="#ed8cb1"><ellipse cx="53" cy="229" rx="15" ry="21"/><ellipse cx="347" cy="229" rx="15" ry="21"/></g><path d="M53 213V245M347 213V245" stroke="#ffe8a6" stroke-width="3"/>`;
  if(index===1)b+=`<circle cx="200" cy="151" r="28" fill="#fff0bd"/><path d="M200 130V151L216 159" fill="none"/><path d="M43 370H133V399H43Z" fill="#8e91ae"/><circle cx="70" cy="375" r="16" fill="#ffe4ac"/><circle cx="112" cy="373" r="12" fill="#a0dcd5"/><path d="M70 353V397M48 375H92" stroke="#fff0c1" stroke-width="5"/>`;
  if(index===2)b+=`<path d="M160 137Q183 128 200 141Q218 128 241 137V174Q218 165 200 177Q182 165 160 174Z" fill="#fff0bd"/><path d="M200 142V176"/><path d="M272 377H350V402H272Z" fill="#f3d0a3"/><path d="M279 377V352H290V377M299 377V343H312V377M323 377V354H338V377" fill="${roof}"/><path d="M64 207l12 -20 15 23m217 0 15 -23 12 20" fill="${wall}"/>`;
  if(index===3)b+=`<path d="M200 122V171M183 135H217M171 158Q200 194 229 158M171 158L168 171M229 158L232 171" fill="none" stroke="#625b76" stroke-width="6"/><path d="M53 364Q95 351 128 364V401Q90 414 53 401Z" fill="#b69b84"/><path d="M60 375H122M60 390H122" fill="none"/><path d="M286 355L336 402M335 355L286 402" stroke="#87768d" stroke-width="8"/><path d="M280 350L293 342L306 355L296 365Z" fill="#9cd8d4"/>`;
  b+='</g>';
  if(index===1){
   b=b.replace('M38 158H362V396Q200 446 38 396Z','M38 158H362V407L200 434L38 407Z');
   b=b.replace(/<path d="M28 104[\s\S]*?<path d="M300 77/,`<path d="M22 109L76 33H324L378 109L362 163H38Z" fill="${roof}" stroke="${ink}" stroke-width="4"/><path d="M76 33H324L348 66H52Z" fill="${trim}" stroke="${ink}" stroke-width="4"/><path d="M82 78H318M60 108H340M41 139H359" fill="none" stroke="#ddf3dc" stroke-width="4"/><path d="M300 77`);
  }
  if(index===2){
   b=b.replace(/<path d="M28 104[\s\S]*?<path d="M300 77/,`<path d="M24 166L75 55L112 91L200 25L288 91L325 55L376 166L356 194H44Z" fill="${roof}" stroke="${ink}" stroke-width="4"/><path d="M52 156L200 58L348 156M81 151L200 75L319 151" fill="none" stroke="${trim}" stroke-width="6"/><path d="M300 77`);
  }
  if(index===3){
   b=b.replace('M38 158H362V396Q200 446 38 396Z','M38 158H362V396Q200 446 38 396Z');
   b=b.replace(/<path d="M28 104[\s\S]*?<path d="M300 77/,`<path d="M18 157Q200 -13 382 157L365 190Q200 225 35 190Z" fill="${roof}" stroke="${ink}" stroke-width="4"/><path d="M60 140Q200 21 340 140M97 117Q200 34 303 117" fill="none" stroke="${trim}" stroke-width="5"/><path d="M300 77`);
   b=`<g transform="translate(0 74) scale(1 .835)">${b}</g>`;
  }
  fs.writeFileSync(dir+name+'.svg',wrap(400,470,b));
  // Seven authored household treatments per trade, including roof changes and lived-in porches.
  for(let v=0;v<7;v++){
   let home=b;
   const tones=[wall,trim,'#eec6b2',wall,'#b8d7cf','#dcc4de',trim];
   const roofs=[roof,roof,'#a295bf','#d49aac',roof,'#90bdb5','#bfaa87'];
   home=home.replaceAll(`fill="${wall}"`,`fill="${tones[v]}"`).replaceAll(`fill="${roof}"`,`fill="${roofs[v]}"`);
   const roofDetail=v===1?`<path d="M130 90Q200 53 270 90V129H130Z" fill="${tones[v]}" stroke="${ink}" stroke-width="4"/><circle cx="200" cy="100" r="19" fill="#a8dfd7" stroke="${ink}" stroke-width="3"/>`:v===3?`<path d="M45 208Q200 170 355 208L340 253Q200 227 60 253Z" fill="${trim}" stroke="${ink}" stroke-width="4"/><path d="M86 207L96 242M143 197L147 235M200 194V232M257 197L253 235M314 207L304 242" stroke="${roofs[v]}" stroke-width="15"/>`:v===4?`<path d="M63 84V19H109V100" fill="${tones[v]}" stroke="${ink}" stroke-width="4"/><path d="M57 19H115" stroke="${roofs[v]}" stroke-width="12"/>`:v===5?`<path d="M121 193L200 133L279 193V221H121Z" fill="${roofs[v]}" stroke="${ink}" stroke-width="4"/><ellipse cx="200" cy="183" rx="22" ry="18" fill="#fff0bd"/>`:'';
   const porch=v===2||v===6?`<path d="M130 375Q200 351 270 375L262 400Q200 382 138 400Z" fill="${roofs[v]}" stroke="${ink}" stroke-width="4"/><path d="M140 397V439M260 397V439" stroke="${ink}" stroke-width="7"/>`:'';
   const domestic=v%3===0?`<path d="M18 375L69 385V415L18 405Z" fill="#bda6c5" stroke="${ink}" stroke-width="3"/><path d="M25 374V348H35V377M44 379V339H57V381" fill="#f8dfa2" stroke="${ink}" stroke-width="2"/>`:v%3===1?`<ellipse cx="331" cy="419" rx="29" ry="13" fill="#d29bb4" stroke="${ink}" stroke-width="3"/><path d="M331 413V366M330 395Q298 373 308 361M332 388Q354 359 363 371" fill="none" stroke="#73984b" stroke-width="7"/>`:`<path d="M24 361H94V401H24Z" fill="#dfc398" stroke="${ink}" stroke-width="3"/><path d="M30 371H88M30 384H88" stroke="#a48b6d" stroke-width="3"/>`;
   fs.writeFileSync(dir+name+'-'+v+'.svg',wrap(400,470,home+roofDetail+porch+domestic));
  }
 }
 const items={
  'yard-fence':[400,115,`<g fill="#e8d6ac" stroke="${ink}" stroke-width="3"><path d="M5 48Q85 75 151 62V83Q79 93 5 70ZM249 62Q325 73 395 48V70Q325 95 249 83Z"/>${[12,48,84,120,144,256,288,324,360,388].map(x=>`<path d="M${x-5} 105V37L${x} 28L${x+5} 37V105Z"/>`).join('')}<g transform="translate(-70 0)"><path d="M187 103V32H209V103" fill="#9ccec6"/><path d="M174 31Q174 10 198 10Q222 10 222 31V50H174Z" fill="#f4b7cb"/><path d="M196 26H214" stroke="#fff0c1"/></g></g>`],
  'washing-line':[430,150,`<g stroke="${ink}" stroke-width="4"><path d="M15 143V15M415 143V15"/><path d="M15 23Q215 92 415 23" fill="none"/><path d="M70 44L95 50L102 72L84 78L84 112L39 100L47 68L36 56L54 40Z" fill="#f4b7cb"/><path d="M156 62L215 67L211 126L148 119Z" fill="#ffedb9"/><path d="M266 60L312 48L332 73L313 87L305 122L262 132L258 94L240 87Z" fill="#9cdbd3"/><path d="M348 42L382 33L391 82L356 91Z" fill="#b9aad5"/></g>`],
  'workbench':[240,190,`<g stroke="${ink}" stroke-width="4"><path d="M15 91L120 64L225 91V114L120 143L15 114Z" fill="#e5cda5"/><path d="M32 119V181M208 119V181M120 143V184" stroke-width="12"/><path d="M58 78V52L83 42L106 53V88Z" fill="#a3dcd4"/><circle cx="155" cy="88" r="22" fill="#ffe4a2"/><path d="M155 66V110M133 88H177M140 73L170 103M140 103L170 73" stroke="#92809d" stroke-width="5"/><path d="M20 126L87 144" stroke="#fff1ce"/></g>`],
  'book-rack':[220,200,`<g stroke="${ink}" stroke-width="4"><path d="M15 35Q110 5 205 35V176Q110 206 15 176Z" fill="#e8c79d"/><path d="M27 91Q110 117 193 91M27 159Q110 185 193 159" fill="none" stroke-width="10"/>${[[35,38,24,50,'#e8a1bc'],[67,44,21,51,'#9cd9d0'],[97,48,22,51,'#c4b0d3'],[132,44,18,51,'#fff0be'],[160,38,21,50,'#a1b8dc'],[35,112,28,47,'#a4d8d3'],[78,118,23,47,'#f3b7c6'],[117,118,23,47,'#9aa3cf'],[157,112,25,47,'#fff0bf']].map(([x,y,w,h,c])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c}"/><path d="M${x+4} ${y+10}h${w-8}" stroke="#fff7d5" stroke-width="2"/>`).join('')}</g>`],
  'noodle-rack':[230,230,`<g stroke="${ink}" stroke-width="4"><path d="M20 220V30M210 220V30M10 35Q115 3 220 35" fill="none" stroke-width="10"/><path d="M45 37Q80 10 111 35Q145 12 180 36" fill="none" stroke="#fff1bc" stroke-width="13"/><path d="M45 38V135M57 38V140M70 33V139M82 31V143M95 34V137M130 33V138M143 30V142M156 31V140M169 34V137M181 38V131" stroke="#f5daa2" stroke-width="7"/><path d="M28 186Q115 165 202 186L185 217Q115 239 45 217Z" fill="#edacbf"/></g>`],
  'boat-repair':[430,250,`<g stroke="${ink}" stroke-width="4"><path d="M65 168V232M365 168V232" stroke-width="14"/><path d="M18 87Q215 16 412 87Q350 229 215 218Q74 225 18 87Z" fill="#bba1bf"/><ellipse cx="215" cy="87" rx="197" ry="63" fill="#f5ddb2"/><ellipse cx="215" cy="87" rx="157" ry="42" fill="#a8dcd4"/><path d="M82 103Q215 151 350 103M70 132Q215 188 363 132M102 170Q215 212 328 170" fill="none"/><path d="M128 66L302 111M132 112L302 62" stroke="#c5aa88" stroke-width="13"/></g>`]
 };
 for(const[n,[w,h,b]]of Object.entries(items))fs.writeFileSync(dir+n+'.svg',wrap(w,h,b));
}
