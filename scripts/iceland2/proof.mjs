import {readFileSync} from 'node:fs';
import sharp from 'sharp';
const out=process.argv[2]??'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/iceland2/fix1';
const art=JSON.parse(readFileSync('public/pixi-art/themes/snow/art.json'));
const w=JSON.parse(readFileSync('assets/world/themes/snow/world.json'));
const nested=(p,anchor)=>{const s=readFileSync('public/pixi-art/themes/snow/'+p.src,'utf8');const root=s.slice(0,s.indexOf('>')+1);const attrs=root.replace(/\s(?:width|height|x|y)="[^"]*"/g,'').replace('<svg','<svg x="'+(p.x-p.width*anchor[0])+'" y="'+(p.y-p.height*anchor[1])+'" width="'+p.width+'" height="'+p.height+'"');return attrs+s.slice(s.indexOf('>')+1);};
const terrain=readFileSync('public/pixi-art/themes/snow/v2/terrain.svg','utf8');const body=terrain.slice(terrain.indexOf('>')+1,terrain.lastIndexOf('</svg>'));
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1448" height="${1448*w.height/w.width}" viewBox="0 0 ${w.width} ${w.height}"><rect width="100%" height="100%" fill="#6EC9DE"/>${body}`;
for(const p of art.flats)svg+=nested(p,p.topLeft?[0,0]:[.5,1]);
for(const p of art.props.toSorted((a,b)=>a.y-b.y))svg+=nested(p,[.5,1]);
svg+='</svg>';
await sharp(Buffer.from(svg)).png().toFile(out+'/proof.png');

for (const name of ['rink','plaza','bakery','lodge','workshop','harbour','snowman','sledHill']) {
 let {x,y}=w.zones[name];
 if(name==='rink'){const rink=art.flats.find(p=>p.id==='rink');x=rink.x+rink.width/2;y=rink.y+rink.height/2;}
 const close=svg.replace(/width="1448" height="[^"]+" viewBox="[^"]+"/,`width="1600" height="900" viewBox="${x-800} ${y-(name==='rink'?450:650)} 1600 900"`);
 await sharp(Buffer.from(close)).png().toFile(`${out}/${name==='rink'?'rink-after':'art-'+name}.png`);
}
