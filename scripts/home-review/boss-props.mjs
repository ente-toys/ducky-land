import {readFileSync,writeFileSync} from 'node:fs';
const F='src/pixi/home-expansion.json',E=JSON.parse(readFileSync(F)),get=id=>E.props.find(p=>p.id===id);
const svg=(w,h,b)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g stroke="#39472d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${b}</g></svg>`;
// The four game-feature sack pairs retain every ID, coordinate and footprint.
writeFileSync('public/pixi-art/home-expansion-c/flour-sacks.svg',svg(230,170,`<ellipse cx="116" cy="153" rx="108" ry="13" fill="#39472d" opacity=".14" stroke="none"/><path d="M7 139L113 130L221 141V155L115 164L7 154Z" fill="#b77e43"/><path d="M13 139L117 132L213 141L113 150Z" fill="#d9a762"/><path d="M35 137L134 145M70 134L170 143M36 153V160M190 151V158" fill="none"/><path d="M25 131Q10 119 23 87L43 49L39 31L52 34L65 27L68 48Q97 79 99 114Q102 139 67 143Q35 145 25 131Z" fill="#ecd09b"/><path d="M66 51Q85 82 88 114Q94 132 73 139L60 142Q100 140 99 116Q97 80 68 48Z" fill="#d5af74" stroke="none"/><path d="M39 47Q53 54 68 47M39 51Q54 57 70 51" fill="none" stroke="#976e3c" stroke-width="3"/><path d="M36 65Q32 80 39 89M80 115Q73 125 72 135M29 120Q35 132 46 132" fill="none" stroke="#b58c53"/><path d="M48 109V82H40L58 65L76 82H67V109Z" fill="#658247"/><path d="M116 139Q100 125 111 96L135 64L131 47L145 50L159 42L166 61Q197 88 205 119Q215 145 180 150Q136 155 116 139Z" fill="#f4dca9"/><path d="M164 64Q190 95 192 123Q198 141 174 148Q210 147 205 120Q198 86 166 61Z" fill="#d6b67e" stroke="none"/><path d="M131 61Q145 68 166 60M133 65Q150 70 168 65" fill="none" stroke="#976e3c" stroke-width="3"/><path d="M126 83Q119 97 128 104M187 126Q178 133 179 144M119 130Q129 141 140 141" fill="none" stroke="#b58c53"/><path d="M148 93H162V104H174V118H162V130H148V118H136V104H148Z" fill="#658247"/>`));
// One joined garden enclosure and three aligned beds, all in one ground camera.
const field=get('hamlet-clovercrust-field-back');
for(const p of E.props.filter(p=>p.id.startsWith('hamlet-clovercrust-field-')||/hamlet-clovercrust-(cabbages|seedlings|wheat)$/.test(p.id)))p.reviewRetired=true;
const fence=`<path d="M36 68H664V204H36Z" fill="#779937" stroke="none"/><path d="M40 57H660M40 74H660M40 57V194M40 74V211M660 57V194M660 74V211M40 194H660M40 211H660" fill="none" stroke="#b98844" stroke-width="8"/>`;
let farm=fence;
for(const x of [40,164,288,412,536,660])farm+=`<path d="M${x-6} 40H${x+6}V88H${x-6}Z M${x-6} 177H${x+6}V222H${x-6}Z" fill="#e3bb70"/><ellipse cx="${x}" cy="40" rx="6" ry="3" fill="#f3d78f"/>`;
for(const x of [58,267,476])farm+=`<path d="M${x} 95H${x+166}V177H${x}Z" fill="#b99554"/><path d="M${x+7} 102H${x+159}V170H${x+7}Z" fill="#9b8049" stroke="none"/>`;
for(const x of [82,125,168,211])for(const y of [115,143])farm+=`<ellipse cx="${x}" cy="${y+6}" rx="15" ry="10" fill="#88ad4a"/><path d="M${x} ${y+15}q-18-11-4-21q21-5 18 11m-14-6v17" fill="none" stroke="#607c36" stroke-width="1.3"/>`;
for(const x of [294,335,376,417])for(const y of [116,150])farm+=`<path d="M${x} ${y+14}v-15q-18-12-18-1q4 11 18 1q17-13 18-2q-3 12-18 2" fill="#7eaa45" stroke-width="1.3"/>`;
for(const x of [500,534,568,602])for(const y of [119,153])farm+=`<path d="M${x} ${y+15}V${y-12}" fill="none" stroke="#eed67a" stroke-width="2"/><path d="M${x} ${y+5}q-14-5-10-13q10 0 10 10q14-5 10-13q-10 0-10 10q-12-12-6-17q10 5 6 14q10-12 6-17q-10 4-6 14" fill="#f0d37c" stroke-width=".9"/>`;
const farmSrc='/pixi-art/home-review/farm-enclosure.svg';writeFileSync('public'+farmSrc,svg(700,240,farm));
E.props.push({id:'home-farm-enclosure',name:'Joined crop garden',asset:'farm-enclosure',src:farmSrc,x:4960,y:-745,width:700,height:240,scale:1,anchor:{x:.5,y:1},z:-744,noShadow:true,footprint:{x:4960,y:-835,rx:315,ry:70}});
E.props=E.props.filter(p=>!p.reviewRetired&&!/hamlet-clovercrust-mill-(left|right)-fence/.test(p.id));
// Windmill: split the original approved sails from the static tower, leave the door base fixed.
const mill=get('hamlet-clovercrust-mill'),file='public'+mill.src;let original=readFileSync(file,'utf8');
if(!original.includes('Sails live')){
 const a=original.indexOf('<path fill="#edc174" d="M68 86'),b=original.indexOf('</g></svg>',a),sails=original.slice(a,b);
 original=original.slice(0,a)+'<!-- Sails live in the separate hub-pivoted layer. -->'+original.slice(b);
 writeFileSync(file,original);
 writeFileSync('public/pixi-art/home-review/windmill-sails.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="380" height="380" viewBox="-115 -115 230 230"><g stroke="#39472d" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" transform="translate(-89 -95)">${sails}</g></svg>`);
}
mill.scale=1.23;mill.shadowSize=[112,23];
const ux=mill.width*mill.scale/180,uy=mill.height*mill.scale/272;
E.props=E.props.filter(p=>p.id!=='home-windmill-sails');
E.props.push({id:'home-windmill-sails',name:'Windmill sails',asset:'windmill-sails',src:'/pixi-art/home-review/windmill-sails.svg',x:mill.x+(89-90)*ux,y:mill.y-(272-95)*uy,width:230*ux,height:230*uy,scale:1,anchor:{x:.5,y:.5},z:mill.y+.1,noShadow:true,spinPeriod:9,zone:'clovercrust'});
writeFileSync(F,JSON.stringify(E,null,2)+'\n');
