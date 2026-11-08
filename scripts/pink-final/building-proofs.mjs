import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {render,read} from './render.mjs';
const out=process.env.PINK_RENDER_OUT??'../concepts/themes/work/pink-fix/final',A='public/pixi-art/themes/pink/';mkdirSync(out+'/joins',{recursive:true});
const art=read(A+'art.json'),report=read('scripts/pink-final/building-report.json'),union=read('scripts/pink-final/path-union-report.json');
const inner=src=>readFileSync(src,'utf8').replace(/^.*?<svg\b[^>]*>/s,'').replace(/<\/svg>\s*$/,'');
const esc=s=>s.replace(/[<&"]/g,c=>({'<':'&lt;','&':'&amp;','"':'&quot;'}[c]));
const og=art.props.find(p=>p.src==='detail/dollhouse-pink.svg'),ow=og.width*og.scale,oh=og.height*og.scale;
const buildings=[...report.buildings];
for(const p of art.props.filter(p=>/hamlets\/.*\/(reading-gazebo|rose-glass-conservatory)\.svg$/.test(p.src)))buildings.push({id:p.id,hamlet:p.hamlet,width:p.width*(p.scale??1),unchanged:true});
const cellW=1140,rowH=820,columns=3,rows=Math.ceil(buildings.length/columns);let parts=[];
for(let i=0;i<buildings.length;i++){
 const b=buildings[i],p=art.props.find(p=>p.id===b.id),x=i%columns*cellW,y=Math.floor(i/columns)*rowH;
 const image=(src,cx,w,h)=>{const root=readFileSync(src,'utf8'),vb=root.match(/viewBox="([^"]+)"/)[1];let content=inner(src);const prefix='proof-'+i+'-'+Math.round(cx)+'-';content=content.replace(/id="([^"]+)"/g,(_,id)=>'id="'+prefix+id+'"').replace(/url\(#([^)]*)\)/g,(_,id)=>'url(#'+prefix+id+')').replace(/href="#([^"]+)"/g,(_,id)=>'href="#'+prefix+id+'"');return `<svg x="${cx-w/2}" y="${y+760-h}" width="${w}" height="${h}" viewBox="${vb}">${content}</svg>`;};
 parts.push(`<text x="${x+30}" y="${y+35}" fill="#39472d" font-family="Arial" font-size="21">${esc(b.hamlet+' / '+p.src.split('/').at(-1))}</text><text x="${x+150}" y="${y+70}" fill="#39472d" font-family="Arial" font-size="19">${b.unchanged?'Existing':'Redraw'}: ${b.width}px</text><text x="${x+730}" y="${y+70}" fill="#39472d" font-family="Arial" font-size="19">Original: ${ow.toFixed(0)}px</text>`);
 for(const [cx,w]of [[x+280,p.width],[x+860,ow]])parts.push(`<ellipse cx="${cx}" cy="${y+760}" rx="${w*.36}" ry="${w*.108}" fill="#3c5a2a" opacity=".15"/>`);
 parts.push(image(A+p.src,x+280,p.width,p.height),image(A+og.src,x+860,ow,oh));
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${columns*cellW}" height="${rows*rowH}"><rect width="100%" height="100%" fill="#8fc63c"/>${parts.join('')}</svg>`;
await sharp(Buffer.from(svg)).png().toFile(out+'/buildings-vs-og.png');console.log('Building comparison:',buildings.length);
// Inspect every independent geometric join with unobstructed production ground and paving details.
const floorArt={...art,props:[],decks:[],flats:art.flats.filter(p=>p.src.startsWith('expansion/merged/'))};
for(const j of union.joins){
 const w=Math.min(1100,Math.max(700,j.bounds[2]-j.bounds[0]+220)),h=Math.min(850,Math.max(550,j.bounds[3]-j.bounds[1]+220));
 await render(floorArt,[j.x-w/2,j.y-h/2,w,h],.8,out+'/joins/'+j.id+'.png',{sleepers:false,boats:[]});
}
writeFileSync(out+'/joins/index.json',JSON.stringify(union.joins,null,2)+'\n');
const thumbs=[];const cols=7,tw=280,th=240;for(let i=0;i<union.joins.length;i++){
 const j=union.joins[i],im=await sharp(out+'/joins/'+j.id+'.png').resize(tw,th-26,{fit:'contain',background:'#8fc63c'}).png().toBuffer();thumbs.push({input:im,left:i%cols*tw,top:Math.floor(i/cols)*th+26});
 const label=Buffer.from(`<svg width="${tw}" height="26"><text x="8" y="20" fill="#39472d" font-family="Arial" font-size="15">${j.id}: ${j.x.toFixed(0)}, ${j.y.toFixed(0)}</text></svg>`);thumbs.push({input:label,left:i%cols*tw,top:Math.floor(i/cols)*th});
}
await sharp({create:{width:cols*tw,height:Math.ceil(union.joins.length/cols)*th,channels:4,background:'#fcebd6'}}).composite(thumbs).png().toFile(out+'/joins/index.png');
console.log('Join closeups:',union.joins.length);
