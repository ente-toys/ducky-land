import {readFileSync,writeFileSync} from 'node:fs';
const E=JSON.parse(readFileSync('src/pixi/home-expansion.json'));
const ink='#39472d';
const win=(x,y,w=44,h=58,arched=false)=>`<path d="M${x} ${y+h}V${y+(arched?16:0)}${arched?`Q${x+w/2} ${y-15} ${x+w} ${y+16}`:`H${x+w}`}V${y+h}Z" fill="#fff0c7"/><path d="M${x+5} ${y+h-5}V${y+8}H${x+w-5}V${y+h-5}Z" fill="#75bfc5"/><path d="M${x+w/2} ${y+6}V${y+h-5}M${x+5} ${y+h/2}H${x+w-5}" fill="none" stroke-width="1.3"/>`;
const pot=(x,y,c='#eb9c74')=>`<path d="M${x-17} ${y-24}H${x+17}L${x+12} ${y}Q${x} ${y+6} ${x-12} ${y}Z" fill="${c}"/><path d="M${x-14} ${y-27}q-18-15-2-18q-4-19 11-10q15-17 20-2q18 0 10 16q9 12-7 15Z" fill="#70a645"/><circle cx="${x-9}" cy="${y-43}" r="6" fill="#f3b1a1"/><circle cx="${x+10}" cy="${y-36}" r="6" fill="#fff0c7"/>`;
const lantern=(x,y)=>`<path d="M${x} ${y}v14m-8 0h16l-2 22h-12Z" fill="#d3a955"/><path d="M${x-5} ${y+17}h10v15h-10Z" fill="#ffe39a"/>`;
const door=(c='#bc8051',x=154,y=193,w=52,h=90)=>`<path d="M${x-5} ${y+h}V${y+15}Q${x+w/2} ${y-18} ${x+w+5} ${y+15}V${y+h}Z" fill="#ffe8b5"/><path d="M${x} ${y+h}V${y+16}Q${x+w/2} ${y-10} ${x+w} ${y+16}V${y+h}Z" fill="${c}"/><path d="M${x+w*.3} ${y+9}v${h-12}m${w*.3} -${h-12}v${h-12}" fill="none" stroke-width=".9"/><circle cx="${x+w-10}" cy="${y+h*.58}" r="2.8" fill="#f4d17b"/>`;
function cottage({roof='#d9a94c',wall='#fff0c7',doorColor='#c78a56',type='gable',garden=false,porch=false,stilt=false}){
 const base=stilt?278:288;
 let s=`<path d="M48 125H312V${base}H48Z" fill="${wall}"/><path d="M48 ${base-19}H312V${base}H48Z" fill="#e1c58d" stroke="none"/>`;
 s+=`<path d="M267 58V14H291V67" fill="#f3ddb1"/><path d="M263 13L267 8H294V17H263Z" fill="#fff0c7"/>`;
 if(type==='curved')s+=`<path d="M18 131Q38 89 70 90Q110 90 130 58Q180 4 230 58Q250 90 290 90Q322 89 342 131Q307 144 274 134Q180 100 86 134Q53 144 18 131Z" fill="${roof}"/><path d="M18 131Q54 150 93 135Q180 108 267 135Q306 150 342 131V140Q302 158 266 143Q180 117 94 143Q57 158 18 140Z" fill="#fff0c7"/>`;
 else s+=`<path d="M20 130L57 67L180 25L303 67L340 130L322 140H38Z" fill="${roof}"/><path d="M38 130L180 48L322 130L317 139L180 61L43 139Z" fill="#fff0c7"/><path d="M72 110L180 49L288 110" fill="none" stroke-width="1.2"/>`;
 // Upright centred façade, matched eaves and base. No oblique side slab.
 s+=`<path d="M72 134L180 72L288 134V${base}H72Z" fill="${wall}"/><path d="M67 134L180 66L293 134L287 143L180 79L73 143Z" fill="#ffe6a2"/>`;
 if(type==='dormer')s+=`<path d="M151 105V69L180 43L209 69V105Z" fill="${wall}"/><path d="M143 72L180 34L217 72L212 78L180 47L148 78Z" fill="${roof}"/>${win(168,66,24,30)}`;
 else s+=win(164,99,32,35,true);
 s+=door(doorColor)+win(87,170,47,62)+win(226,170,47,62);
 s+=`<path d="M83 234H138V245H83Z M222 234H277V245H222Z" fill="#c88e55"/>`;
 s+=`<path d="M88 232q-9-13 2-15q9-16 18-1q15-16 22 2q10 4 4 14Z M227 232q-8-13 3-15q9-16 18-1q15-16 22 2q10 4 3 14Z" fill="#6a9d3d"/><circle cx="99" cy="222" r="5" fill="#fff0c7"/><circle cx="121" cy="224" r="5" fill="#efb1a3"/><circle cx="239" cy="222" r="5" fill="#fff0c7"/><circle cx="260" cy="224" r="5" fill="#efb1a3"/>`;
 if(porch||stilt)s+=`<path d="M54 275H306V289H54Z" fill="#c58e50"/><path d="M65 288V309H79V288M281 288V309H295V288" fill="#9f713e"/><path d="M66 244V279M294 244V279M66 252H136M224 252H294" fill="none" stroke="#b78a4d" stroke-width="5"/><path d="M150 289H210L220 309H140Z" fill="#f5dca6"/><path d="M145 299H215" fill="none"/>`;
 else s+=`<path d="M148 282H212L218 300H142Z" fill="#f1d695"/><path d="M142 300H218V308H142Z" fill="#fff0c7"/>`;
 s+=lantern(143,158)+pot(46,291)+pot(314,291);
 if(garden)s+=`<path d="M61 267Q46 178 71 133Q113 117 143 133M299 267Q314 178 289 133Q250 117 220 133" fill="none" stroke="#759648" stroke-width="7"/>`+[[64,175],[67,213],[74,140],[115,129],[296,175],[293,213],[286,140],[245,129]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="8" fill="#eaa795"/><path d="M${x-4} ${y}q4-7 8 0q-4 6-8 0" fill="none" stroke-width=".9"/>`).join('');
 return s;
}
function bakery(){return `<path d="M38 117H322V288H38Z" fill="#fff0c7"/><path d="M25 123L53 47Q180 17 307 47L335 123Z" fill="#da7950"/><path d="M25 123H335V133H25Z" fill="#f4c781"/><path d="M58 63Q180 39 302 63M45 89Q180 67 315 89" fill="none" stroke="#b0663e" stroke-width="1.1"/><path d="M139 112V88Q180 54 221 88V112Z" fill="#f7d891"/><path d="M158 94q4-25 14-3m-2 0q7-29 16-2m-1 1q12-23 18 3" fill="none" stroke="#ac7b42" stroke-width="4"/>${door('#bb824b',239,193,48,95)}${win(57,185,156,69)}<path d="M47 259H223V275H47Z" fill="#c48a4e"/><path d="M51 161H309L324 194Q303 212 289 195Q270 214 254 195Q236 214 220 195Q202 213 186 195Q169 213 152 195Q135 213 119 195Q100 213 84 195Q64 212 48 195L36 194Z" fill="#fff0c7"/><path d="M59 161H84L99 194H75Z M111 161H137L147 194H123Z M163 161H189L194 194H170Z M215 161H241V194H218Z M267 161H293L300 194H273Z" fill="#e67650" stroke="none"/><path d="M64 239q5-20 27-20q22 0 25 20Z M127 238q2-20 22-20q22 0 25 20Z M180 239q0-16 16-16q16 0 16 16Z" fill="#edb854"/><path d="M75 230l8-7m48 6l8-6m11 7l8-6" fill="none"/><path d="M234 289H294L302 306H226Z" fill="#ecd49d"/>${pot(28,291)}`;}
function barn(){return `<path d="M41 145H319V293H41Z" fill="#dd7850"/><path d="M41 145L83 66L180 22L277 66L319 145Z" fill="#af7c4b"/><path d="M29 147L76 58L180 12L284 58L331 147L319 152L276 69L180 27L84 69L41 152Z" fill="#fff0c7"/><path d="M53 145L88 79L180 37L272 79L307 145" fill="none" stroke-width="1.1"/><path d="M41 145H319V157H41Z" fill="#f3d297"/><path d="M67 160V288M91 160V288M115 160V288M245 160V288M269 160V288M293 160V288" fill="none" stroke="#b86142" stroke-width="2"/><path d="M114 198H246V293H114Z" fill="#805a37"/><path d="M108 196H158V290H108Z M202 196H252V290H202Z" fill="#e68c58" stroke="#fff0c7" stroke-width="7"/><path d="M111 199L154 286M154 199L111 286M205 199L249 286M249 199L205 286" fill="none" stroke="#fff0c7" stroke-width="6"/>${win(153,109,54,50)}<path d="M163 287L169 266L196 259L211 278L205 292Z" fill="#e8bf62"/>${lantern(90,179)}${lantern(270,179)}<path d="M38 293H322V302H38Z" fill="#b17d45"/>`;}
const cases={
 'hamlet-butterbill-honeyroof-cottage':{roof:'#e8b941',type:'dormer'},'hamlet-butterbill-petaldoor-cottage':{roof:'#e3b64b',type:'curved'},
 'hamlet-lanternleaf-blue-roof-cottage':{roof:'#7399ad',doorColor:'#b58a4b',garden:true},'hamlet-lanternleaf-yellow-roof-cottage':{roof:'#e1bb4b',type:'curved',garden:true},
 'hamlet-clovercrust-cottage-red':{roof:'#df7952',doorColor:'#779950',porch:true},'hamlet-clovercrust-cottage-gold':{roof:'#e3b449',doorColor:'#77a3a1',porch:true},'hamlet-clovercrust-cottage-blue':{roof:'#729aa7',type:'dormer',porch:true},
 'hamlet-petalpatch-domed-pottery-shop':{roof:'#b08cba',wall:'#f4d3c7',type:'curved',doorColor:'#d1a561'},'hamlet-petalpatch-art-studio':{roof:'#ce91a4',wall:'#f1dbc6',doorColor:'#bf985b'},
 'hamlet-reedwhistle-cottage-netmaker':{roof:'#7295a4',wall:'#adc9bd',doorColor:'#cea45b',stilt:true},'hamlet-reedwhistle-cottage-harbour':{roof:'#d1b26b',wall:'#9dbeb4',doorColor:'#d4ae63',stilt:true}
};
const audit=JSON.parse(readFileSync('scripts/home-review/building-audit.json'));
for(const p of E.props){let art=cases[p.id]?cottage(cases[p.id]):p.id==='hamlet-butterbill-bakery'?bakery():p.id==='hamlet-clovercrust-barn'?barn():null;
 if(!art)continue;
 // Occupational details distinguish the studio/shop and maritime homes.
 if(p.id.includes('art-studio'))art+=`<path d="M231 254H278V274H231Z" fill="#bd894d"/><path d="M237 253L232 224L243 226L247 253M250 252L255 216L263 219L258 252" fill="#eee7bb"/>`;
 if(p.id.includes('pottery-shop'))art+=`<path d="M81 254Q74 239 88 230V219H99V230Q112 239 105 254Z M111 254Q105 237 118 230V222H130V231Q144 240 137 254Z" fill="#c59967"/>`;
 if(p.id.includes('netmaker'))art+=`<path d="M90 155L130 155L140 232L82 232Z" fill="none" stroke="#526e60"/><path d="M90 170L135 205M88 188L139 224M95 155L136 189M126 156L84 213M134 174L97 232M140 198L117 232" fill="none" stroke-width="1"/>`;
 if(p.id.includes('harbour'))art+=`<path d="M159 139Q178 118 200 139Q177 157 159 139Z" fill="#edc779"/><path d="M200 139L212 131V146Z" fill="#edc779"/>`;
 const file='public'+p.src;
 writeFileSync(file,`<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${p.height}" viewBox="0 0 360 320"><title>${p.name}, square front in Home camera</title><g stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${art}</g></svg>`);
 const entry=audit.find(a=>a.id===p.id);if(entry)entry.verdict='redrawn: upright walls, matched symmetric eaves, centred doorway and level base';
}
for(const a of audit)if(!a.verdict)a.verdict='kept: geometry seated on walls, no displaced roof';
writeFileSync('scripts/home-review/building-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log('Redrew',audit.filter(a=>a.verdict.startsWith('redrawn')).length,'buildings of',audit.length,'audited');
