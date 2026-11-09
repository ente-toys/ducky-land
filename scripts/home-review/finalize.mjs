import fs from 'node:fs';
const F='src/pixi/home-expansion.json',E=JSON.parse(fs.readFileSync(F));
E.groundDecals=E.groundDecals.filter((d,i)=>!(d.x>6000&&d.x<7500&&d.y>2500&&d.y<3750&&i%3===0));fs.writeFileSync(F,JSON.stringify(E,null,2)+'\n');
// A water-facing contact strip sits immediately under the existing dock beam.
const file='public/pixi-art/home-expansion-c/fishing-deck.svg';let s=fs.readFileSync(file,'utf8');
if(!s.includes('home-quay-contact')){const i=s.indexOf('</defs>')+8;s=s.slice(0,i)+'<g id="home-quay-contact" fill="#39472d" opacity=".13"><path d="M45 329H680V349H45Z M880 329H1390V349H880Z M660 585H905V607H660Z"/></g>'+s.slice(i);fs.writeFileSync(file,s);}
