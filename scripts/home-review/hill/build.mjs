import fs from 'node:fs';
const dir='public/pixi-art/home-review/hill';fs.mkdirSync(dir,{recursive:true});
const svg=(w,h,s)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g stroke="#39472d" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${s}</g></svg>`;
fs.writeFileSync(dir+'/telescope.svg',svg(190,225,`
<ellipse cx="93" cy="207" rx="83" ry="13" fill="#39472d" opacity=".15" stroke="none"/>
<path d="M92 105L88 201Q97 207 107 201L107 104Z" fill="#b98748"/><path d="M85 105L29 200Q25 211 42 213Q51 213 55 204L102 114L139 206Q144 214 158 210Q165 207 161 198L116 102Z" fill="#d4a363"/>
<path d="M89 116L48 202M113 119L151 201" stroke="#e6bc7b" stroke-width="5"/>
<g transform="rotate(-26 96 66)"><path d="M15 52H48V73H15Z" fill="#6b9fbc"/><path d="M10 54H21V71H10Z" fill="#437894"/><rect x="43" y="35" width="119" height="55" rx="14" fill="#fff0c7"/><path d="M50 72H158V87H54Q44 85 43 72Z" fill="#dfcd9e" stroke="none"/><path d="M74 35V90H86V35Z" fill="#73abc5"/><ellipse cx="157" cy="62" rx="23" ry="37" fill="#659ebc"/><ellipse cx="160" cy="62" rx="15" ry="27" fill="#42718d"/><ellipse cx="163" cy="59" rx="10" ry="20" fill="#9ed8e5" stroke="none"/><ellipse cx="165" cy="50" rx="4" ry="8" fill="#def4ed" stroke="none"/></g>
<path d="M91 93Q116 87 119 105L110 120L86 118Z" fill="#ba8c50"/><circle cx="96" cy="109" r="16" fill="#d5ab68"/><circle cx="96" cy="109" r="9" fill="#f5d593"/>
`));
fs.writeFileSync(dir+'/bench.svg',svg(200,130,`
<ellipse cx="101" cy="115" rx="94" ry="12" fill="#39472d" opacity=".15" stroke="none"/>
<path d="M24 81L20 117L34 121L39 85M162 80L164 118L180 115L176 78" fill="#b3854c"/>
<path d="M18 59L15 17Q15 12 23 11L168 6Q175 6 176 14L179 57Z" fill="#c99957"/>
<path d="M20 34L175 28M21 52L177 46" stroke="#9d713e" stroke-width="2.5"/>
<path d="M11 69L170 54L193 72L34 94L11 83Z" fill="#d4a563"/><path d="M34 94V106L193 83V72Z" fill="#b8874d"/><path d="M11 83L34 106V94" fill="#b8874d"/>
<path d="M24 72L180 61M32 84L187 71" stroke="#f0c783" stroke-width="2.5"/>
<g fill="#936b3e" stroke="none"><circle cx="29" cy="23" r="3"/><circle cx="163" cy="18" r="3"/><circle cx="31" cy="44" r="3"/><circle cx="165" cy="39" r="3"/></g>
`));
fs.writeFileSync(dir+'/star-sign.svg',svg(105,145,`
<ellipse cx="51" cy="134" rx="33" ry="8" fill="#39472d" opacity=".15" stroke="none"/>
<path d="M46 25L43 132L57 134L62 25Z" fill="#b7894d"/><path d="M15 28L86 33L99 58L83 80L10 71Q5 70 6 61L10 34Q10 27 15 28Z" fill="#d8ac69"/><path d="M13 61L84 70L93 58" fill="none" stroke="#bd8e50"/>
<path d="M52 38L59 50L73 53L62 62L63 75L50 68L38 73L40 59L31 48L45 48Z" fill="#fff0b2" stroke-width="2.5"/>
<path d="M30 134Q24 117 31 120L43 132Q40 112 47 117L51 132Q63 117 66 123L60 136" fill="#6c9d3f" stroke="none"/>
`));
const mound=`<g data-name="Stargazing hill mound" stroke-linejoin="round"><path d="M32 294C53 232 157 192 230 163C308 129 410 133 481 166C563 199 634 244 668 292C684 320 628 359 539 370C435 396 312 392 217 379C113 367 18 339 32 294Z" fill="#6f982e" opacity=".55"/><path d="M39 278C75 216 151 205 224 166C297 125 414 132 480 165C551 199 618 227 658 278C678 310 625 326 568 331C517 370 459 350 409 364C354 382 295 358 253 363C202 375 157 343 113 341C66 338 27 311 39 278Z" fill="#a9c94c"/><path d="M56 265C114 210 168 205 225 174C305 137 405 142 474 173C540 201 606 232 644 270" fill="none" stroke="#c0d86a" stroke-width="7" stroke-linecap="round"/>
<g fill="#58933c" stroke="#39472d" stroke-width="3"><path d="M75 303Q59 291 72 280Q66 261 85 261Q96 239 112 253Q130 248 135 268Q154 278 139 292Q129 308 108 302Z"/><path d="M552 330Q534 314 548 301Q545 281 565 283Q580 260 596 280Q616 276 618 295Q639 313 619 326Q598 336 580 328Z"/></g>
<g fill="#fff0c7">${[[91,273],[117,285],[567,300],[601,312]].map(([x,y])=>`<g transform="translate(${x} ${y})"><circle cx="-5" cy="-3" r="5"/><circle cx="4" cy="-5" r="5"/><circle cx="7" cy="3" r="5"/><circle cx="-2" cy="6" r="5"/><circle cx="0" cy="0" r="3.5" fill="#edc65c"/></g>`).join('')}</g>
<g stroke="#39472d" stroke-width="3"><path d="M131 324Q137 300 157 304Q173 309 174 326Q153 334 131 324Z" fill="#b6bba2"/><path d="M523 341Q524 321 543 319Q564 319 567 338Q547 347 523 341Z" fill="#b6bba2"/><path d="M182 338Q185 328 194 331L199 339Z" fill="#d1d0b1"/></g>
<g fill="#709f3c"><path d="M205 243q-17-20-20-8q3 16 20 8m3 0q-2-24 7-19q7 8-7 19m4 2q18-18 20-7q-1 10-20 7M470 300q-19-20-20-9q3 15 20 9m3 0q-1-24 8-18q5 8-8 18"/></g></g>`;
fs.writeFileSync(dir+'/mound.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="410" viewBox="0 0 700 410">${mound}</svg>`);
fs.writeFileSync('scripts/home-review/hill/mound.svgfrag',mound);
const E=JSON.parse(fs.readFileSync('src/pixi/home-expansion.json'));
const sites=[{id:'northeast',x:6500,y:1250,trail:[[6600,1210],[6540,1270],[6480,1310],[6430,1375],[6200,1450],[6000,1550],[5772,1800]]},{id:'southwest',x:-450,y:4500,trail:[[-350,4460],[-410,4520],[-470,4560],[-520,4625],[-740,4600],[-890,4480],[-900,4336]]}];
E.stargazingHills=sites;
E.props=E.props.filter(p=>!String(p.id).startsWith('home-hill-'));
for(const s of sites)for(const [name,dx,dy,w,h,rx,ry] of [['telescope',105,-20,190,225,62,19],['bench',-155,10,200,130,90,19],['star-sign',240,24,105,145,16,10]]){
 E.props.push({id:`home-hill-${s.id}-${name}`,name:`stargazing-${name}`,asset:`stargazing-${name}`,src:`/pixi-art/home-review/hill/${name}.svg`,x:s.x+dx,y:s.y+dy,width:w,height:h,scale:1,anchor:{x:.5,y:1},resolution:2,noShadow:true,footprint:{x:s.x+dx,y:s.y+dy-12,rx,ry}});
}
fs.writeFileSync('src/pixi/home-expansion.json',JSON.stringify(E,null,2)+'\n');
const sizes=JSON.parse(fs.readFileSync('src/pixi/art-source-sizes.json'));for(const [n,w,h] of [['telescope',190,225],['bench',200,130],['star-sign',105,145],['mound',700,410]])sizes[`/pixi-art/home-review/hill/${n}.svg`]=[w,h];fs.writeFileSync('src/pixi/art-source-sizes.json',JSON.stringify(sizes)+'\n');
