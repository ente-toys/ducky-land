// Uses the installed libvips/librsvg renderer, not a browser screenshot.
const fs=require('fs'), path=require('path');
const sharp=require('/Users/pragadees.xd/Developer/ente-merch/node_modules/sharp');
const root=__dirname;
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json')));
fs.mkdirSync(path.join(root,'sheets'),{recursive:true});
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
function nested(file,x,y,w,h,uid){
 let s=fs.readFileSync(path.resolve(root,file),'utf8');
 // Repeated original duck masks must have unique identifiers in a sheet.
 s=s.replace(/id="([^"]+)"/g,(_,v)=>`id="${uid}-${v}"`).replace(/url\(#([^)]+)\)/g,(_,v)=>`url(#${uid}-${v})`);
 return s.replace('<svg ',`<svg x="${x}" y="${y}" width="${w}" height="${h}" `).replace(/ width="[^"]+" height="[^"]+" viewBox/, ' viewBox');
}
function header(w,h,title,sub){return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#FFF4C5"/><text x="30" y="44" font-family="Arial" font-weight="bold" font-size="27" fill="#232323">${esc(title)}</text><text x="30" y="73" font-family="Arial" font-size="14" fill="#565656">${esc(sub)}</text>`}
async function output(name,svg){
 fs.writeFileSync(path.join(root,'sheets',name+'.svg'),svg);
 await sharp(Buffer.from(svg),{limitInputPixels:false}).png().toFile(path.join(root,'sheets',name+'.png'));
}
async function main(){
 for(const category of [...new Set(manifest.assets.map(a=>a.category))]){
  const aa=manifest.assets.filter(a=>a.category===category), cols=5,cw=310,ch=285,w=cols*cw+40,h=Math.ceil(aa.length/cols)*ch+120;
  let s=header(w,h,`Ducky Land / ${category} / ${aa.length} assets`,'Detail contact sheet. Each cell fits independently. See true-scale-all.png for world proportions.');
  for(let i=0;i<aa.length;i++){
   const a=aa[i],xx=20+(i%cols)*cw,yy=100+Math.floor(i/cols)*ch;
   s+=`<rect x="${xx+4}" y="${yy+4}" width="${cw-8}" height="${ch-8}" rx="14" fill="#FFFFFF"/>`;
   const sc=Math.min((cw-30)/a.size.width,(ch-65)/a.size.height);
   const ww=a.size.width*sc,hh=a.size.height*sc;
   s+=nested(a.file,xx+(cw-ww)/2,yy+16+(ch-65-hh)/2,ww,hh,`a${i}`);
   s+=`<text x="${xx+15}" y="${yy+ch-31}" font-family="Arial" font-weight="bold" font-size="14" fill="#232323">${a.name}</text><text x="${xx+15}" y="${yy+ch-12}" font-family="Arial" font-size="12" fill="#727272">${a.size.width} × ${a.size.height} / ${a.size.ducky_units.width}w × ${a.size.ducky_units.height}h duck</text>`;
  }
  await output(category,s+'</svg>');console.log(category,aa.length);
 }
 const scale=.19,w=3200,pad=30,gap=24,ref=manifest.reference.file;
 let rows=[],row=[],x=pad,maxH=0;
 for(const a of manifest.assets){
  const ww=a.size.width*scale;
  if(x+ww+713*scale+60>w-pad&&row.length){rows.push({aa:row,h:maxH});row=[];x=pad;maxH=0;}
  row.push({a,x});x+=ww+gap;maxH=Math.max(maxH,a.size.height*scale);
 }
 if(row.length)rows.push({aa:row,h:maxH});
 const h=120+rows.reduce((a,r)=>a+Math.max(r.h,937*scale)+65,0);
 let s=header(w,Math.ceil(h),'Ducky Land / complete world-scale library',`All ${manifest.assets.length} assets and original Drip Ducky share scale ${scale}. 713 × 937 source canvas. Baselines align to anchors, not transparent reference padding.`);
 let y=115;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],rh=Math.max(r.h,937*scale),baseline=y+rh;
  s+=`<path d="M25 ${baseline} H${w-25}" stroke="#EFD58E" stroke-width="1"/>`;
  for(const {a,x} of r.aa){
   const ww=a.size.width*scale,hh=a.size.height*scale;
   s+=nested(a.file,x,baseline-a.anchor.y*scale,ww,hh,`r${i}-${a.name}`);
   s+=`<text x="${x}" y="${baseline+24}" font-family="Arial" font-size="12" fill="#565656">${a.category}/${a.name}</text>`;
  }
  const dx=w-713*scale-25;
  s+=nested(ref,dx,baseline-776*scale,713*scale,937*scale,`duck${i}`);
  s+=`<text x="${dx+18}" y="${baseline+24}" font-family="Arial" font-weight="bold" font-size="12" fill="#232323">DRIP DUCKY / 1×</text>`;
  y=baseline+65;
 }
 await output('true-scale-all',s+'</svg>');
 // Representative style comparison at a larger shared scale.
 let sel=['tree-palm','tree-baguette','bench-wood','bakery','lighthouse-duck','loaf','flower-daisy','rowboat'];
 const selected=sel.map(n=>manifest.assets.find(a=>a.name===n)).filter(Boolean);
 let sx=30,sbase=1040,ss=.25;
 const sw=selected.reduce((v,a)=>v+a.size.width*ss+40,350);
 s=header(Math.ceil(sw),1200,'Drip source / world illustration comparison','Every illustration uses the same world units, 7.5-unit ink, flat right shade and white edge streak.');
 for(const a of selected){s+=nested(a.file,sx,sbase-a.anchor.y*ss,a.size.width*ss,a.size.height*ss,'cmp'+a.name);sx+=a.size.width*ss+40;}
 s+=nested(ref,sx,sbase-776*ss,713*ss,937*ss,'comparisonduck');
 await output('style-comparison',s+'</svg>');
 console.log('Rendered all sheets with librsvg',sharp.versions.rsvg);
}
main().catch(e=>{console.error(e);process.exit(1)});
