// Hand-authored flat vector parts traced from the approved option-1 reference.
// Kept separate so the hut, furniture and shoreline can be depth sorted.
export const LAKE_ASSETS = new Map();
const svg=(name,w,h,body)=>LAKE_ASSETS.set(name,{width:w,height:h,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" stroke="#39472d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><title>${name.replaceAll('-',' ')}</title>${body}</svg>\n`});
const snow='#fffcef',wood='#efc052',dark='#cb9340',teal='#168e88';
const plank=(y)=>`<path d="M44 ${y}H316" stroke="#b69457" stroke-width="2"/>`;
svg('warming-hut',360,320,`
 <path d="M78 72V25H115V88" fill="#8d9389"/><path d="M71 27Q70 15 82 15H111Q125 15 122 27Z" fill="${snow}"/>
 <path d="M43 155L180 57L317 155V284H43Z" fill="#fff2c6"/>
 ${[181,207,233,259].map(plank).join('')}
 <path d="M37 152L180 46L324 152L315 171L180 73L47 171Z" fill="#ed8060"/>
 <path d="M21 136Q65 91 94 73Q120 56 151 40Q179 24 207 40Q241 62 270 85L338 140Q349 154 336 164Q326 171 313 158L296 144Q287 167 269 155L251 137Q245 158 227 142L209 124Q199 140 183 126L165 115Q150 139 134 130L115 117Q106 143 87 136L66 132Q52 154 36 153Q15 153 21 136Z" fill="${snow}"/>
 <path d="M124 134L180 91L236 134Z" fill="${wood}"/><path d="M180 94V132M151 114L163 133M207 113L195 133"/>
 <path d="M219 284V191Q219 158 246 158Q274 158 274 191V284Z" fill="${teal}"/>
 <path d="M232 202V188Q232 172 247 172Q261 172 261 188V202Z" fill="#ffdf72"/><path d="M247 173V202M231 188H262" stroke="#fff3b1"/>
 <circle cx="231" cy="233" r="5" fill="#f4c74b"/>
 ${[67,137].map(x=>`<rect x="${x}" y="169" width="51" height="58" rx="5" fill="#ffda59"/><path d="M${x+25} 170V226M${x} 198H${x+51}"/>`).join('')}
 <path d="M38 282H321V295H38Z" fill="${dark}"/><path d="M211 292H284L294 305H202Z" fill="${wood}"/><path d="M202 305H294L304 316H193Z" fill="${wood}"/>
 <path d="M48 155V281M312 155V281" stroke="${dark}" stroke-width="10"/>
`);
svg('jetty',240,148,`
 <path d="M30 69H210V122H30Z" fill="${dark}"/>
 <path d="M30 55L174 25L222 61L78 96Z" fill="#f4ce5f"/>
 <path d="M65 48L112 88M101 40L149 79M138 32L186 70M32 67L79 106L221 72V61"/>
 ${[[28,65],[215,65],[78,109]].map(([x,y])=>`<path d="M${x-10} ${y}V${y+28}Q${x} ${y+36} ${x+10} ${y+28}V${y}Z" fill="${wood}"/><ellipse cx="${x}" cy="${y}" rx="13" ry="8" fill="${snow}"/>`).join('')}
`);
for(let i=1;i<=3;i++)svg('rock-'+i,140,90,`
 <path d="M8 78Q16 ${i===2?43:54} 41 35Q67 13 91 37Q118 38 132 76Q103 89 74 80Q43 87 8 78Z" fill="${['#989c94','#8e958b','#a3a69b'][i-1]}"/>
 <path d="M17 57Q36 24 57 22Q84 10 105 40Q127 50 117 60Q107 65 94 57Q77 50 62 60Q44 70 35 60Q21 67 17 57Z" fill="${snow}"/>
`);
for(let i=1;i<=2;i++)svg('reeds-'+i,110,125,`
 <path d="M37 119Q31 80 10 63Q32 66 46 97Q45 54 35 24Q53 41 56 90Q71 57 81 23Q85 57 68 99Q91 70 103 77Q80 99 74 119" fill="#f6d46c"/>
 <path d="M46 120L35 28M64 120L79 30" stroke-width="3"/>
 <path d="M30 36L25 15Q24 6 30 6Q36 5 38 13L43 33Q42 43 36 43Q31 43 30 36Z" fill="${wood}"/>
 <path d="M72 33L78 13Q82 4 88 8Q94 11 90 20L83 40Q78 48 73 43Z" fill="${wood}"/>
`);
svg('bench-skates',310,228,`
 <path d="M41 126L30 205H49L68 127M246 128L263 207H282L268 128" fill="${dark}"/>
 <rect x="29" y="43" width="253" height="70" rx="8" fill="${wood}"/><path d="M31 78H281"/>
 <path d="M34 38Q46 30 68 36L121 42Q146 35 176 41L230 43Q252 33 278 43Q291 46 286 58Q280 69 263 62L244 59Q227 72 207 62L167 61Q151 68 134 60L83 59Q65 67 50 57Q30 63 27 52Q24 43 34 38Z" fill="${snow}"/>
 <path d="M21 130L283 130L299 151H10Z" fill="${wood}"/><path d="M12 151V165H298V151" fill="${dark}"/>
 <path d="M21 124Q50 115 77 121L167 124Q198 118 226 122L284 128Q300 130 295 141Q290 150 277 144L237 140Q221 148 201 140L143 138Q128 146 110 137L60 136Q41 143 29 135Q7 141 10 132Q11 127 21 124Z" fill="${snow}"/>
 <path d="M188 39Q197 30 213 34L234 39Q224 57 222 89L214 116L178 111L184 79Q188 58 188 39Z" fill="#ec8067"/>
 <path d="M194 105L214 108L211 120L181 116L183 105" fill="${snow}"/><path d="M187 108L185 119M195 109L193 121M203 110L201 122" stroke-width="2"/>
 <path d="M202 47L199 72M191 53L211 65M190 65L211 52" stroke="${snow}" stroke-width="4"/>
 ${[[42,0],[93,4]].map(([x,y])=>`<g transform="translate(${x} ${y})"><path d="M0 201L5 184L22 171L29 142L53 145L48 177L58 199Q50 211 24 210H2Z" fill="${teal}"/><path d="M5 197L18 184L30 178L36 148L48 150L42 185L50 197Q38 204 5 201Z" fill="${snow}"/><path d="M5 216H57M15 207V216M44 207V216M25 169L38 173M22 177L35 181M17 185L29 188" stroke-width="3"/></g>`).join('')}
`);
svg('lantern-post',160,260,`
 <path d="M107 40V248H129V40" fill="${wood}"/><path d="M114 44V245" stroke="${dark}" stroke-width="4"/>
 <path d="M38 32H130V48H38Z" fill="${wood}"/><path d="M88 48L108 70V48" fill="${dark}"/>
 <path d="M32 29Q35 18 53 22L84 23Q105 17 130 24Q143 27 139 38Q136 47 119 42L101 40Q86 49 72 40L49 39Q30 44 29 35Z" fill="${snow}"/>
 <path d="M55 49V66"/><path d="M46 74V66H63V74L79 93H30Z" fill="${teal}"/>
 <path d="M34 95H75V147H34Z" fill="#ffdb64"/><path d="M47 96V147M64 96V147" stroke-width="3"/>
 <path d="M31 148H79V158H31Z" fill="${teal}"/><path d="M30 93H79"/>
 <path d="M98 248Q115 239 136 248" stroke="${snow}" stroke-width="11"/>
`);
svg('mug-table',190,132,`
 <path d="M30 77V121H45V80M144 77V121H160V78" fill="${dark}"/>
 <path d="M14 60H176V80H14Z" fill="${wood}"/>
 <path d="M23 53L158 50L176 60H14Z" fill="#f8d778"/>
 ${[40,82].map(x=>`<path d="M${x} 28H${x+26}V50Q${x+13} 62 ${x} 50Z" fill="${snow}"/><path d="M${x} 33Q${x-16} 27 ${x-13} 41Q${x-12} 49 ${x} 46"/><ellipse cx="${x+13}" cy="28" rx="13" ry="5" fill="${teal}"/>`).join('')}
 <path d="M120 58Q128 45 141 49L164 49L166 65L121 69Z" fill="#ed8060"/><path d="M134 56H157" stroke-width="3"/>
 <path d="M122 70H164V91Q154 99 144 91Q133 98 122 91Z" fill="${teal}"/><path d="M130 90V102M140 92V104M150 92V104M159 90V102" stroke-width="3"/>
`);
svg('woodpile',180,156,`
 <path d="M15 44H165V145H15Z" fill="#b18346"/><path d="M23 45H157V141H23Z" fill="#6f744f"/>
 ${[[44,73],[82,75],[125,72],[42,110],[82,113],[125,110]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="18" ry="19" fill="#edc768"/><ellipse cx="${x}" cy="${y}" rx="6" ry="7" stroke="#be9c4b" stroke-width="2"/>`).join('')}
 <path d="M13 39Q24 17 57 17Q84 8 116 18Q146 17 167 34Q178 45 168 52Q154 59 142 48Q123 57 107 47Q89 59 71 48Q53 58 36 48Q15 58 10 46Z" fill="${snow}"/>
 <path d="M17 50V147M162 50V147" stroke="${wood}" stroke-width="8"/>
`);
svg('sled',115,155,`
 <path d="M19 18L49 132Q54 148 65 141Q74 137 68 123M79 14L106 125Q111 142 99 145" stroke="${dark}" stroke-width="10"/>
 <path d="M29 25Q26 14 37 12L66 8Q77 7 81 21L101 112Q104 123 92 126L66 132Q53 134 50 121Z" fill="#ee8163"/>
 <path d="M54 12L81 128M45 94L95 84M34 45L84 36" stroke="#c86851" stroke-width="3"/>
 <path d="M29 25L16 19Q6 15 6 27L31 129Q35 145 46 136M82 20L93 14" stroke="${wood}" stroke-width="6"/>
`);
svg('ice-decal',780,455,`
 <path id="heart-carving" d="M396 365C340 302 160 258 147 185C129 96 294 61 383 156C459 59 624 47 643 126C666 214 477 280 326 386" stroke="#fffefa" stroke-width="5"/>
 <path id="skate-swirl-lines" d="M91 111Q123 79 166 74M103 128Q140 95 189 87M544 345Q637 334 691 291M571 357Q645 348 703 309" stroke="#fffefa" stroke-width="3"/>
 <path d="M111 257Q184 287 217 328M514 43Q548 30 590 34" stroke="#ccecf3" stroke-width="3"/>
`);
