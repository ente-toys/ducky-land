"""Collect canonical game assets and build a standalone, searchable gallery."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'extracted-assets'
OUT.mkdir(exist_ok=True)
files = []
for folder in ['assets', 'duck-spin', 'drip-ref', 'rive']:
    for p in sorted((ROOT / folder).rglob('*')):
        if p.is_file() and p.suffix.lower() in {'.svg', '.png', '.jpg', '.webp', '.wav', '.ttf', '.riv'}:
            files.append(p)
entries = []
by_hash = {}
for p in files:
    rel = p.relative_to(ROOT).as_posix()
    digest = hashlib.sha256(p.read_bytes()).hexdigest()
    if digest in by_hash:
        by_hash[digest]['sources'].append(rel)
        continue
    if rel.startswith('assets/'):
        group = p.parent.name.title()
        role = 'Game asset library'
    elif rel.startswith('duck-spin/'):
        group, role = 'Duck views', 'Character source artwork'
    elif rel.startswith('drip-ref/'):
        group, role = 'Wardrobe', 'Character and wardrobe source artwork'
    elif p.suffix == '.wav':
        group, role = 'Sounds', 'Runtime sound effect'
    elif p.suffix == '.ttf':
        group, role = 'Fonts', 'Bundled font'
    else:
        group, role = 'Animation', 'Compiled Rive runtime; includes generated scenery and animations'
    dest = OUT / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dest)
    entry = dict(name=p.stem, category=group, role=role, path=rel, sources=[rel], extension=p.suffix, bytes=p.stat().st_size)
    entries.append(entry)
    by_hash[digest] = entry
for rel in ['assets/manifest.json', 'rive/web/asset-library.json', 'rive/web/world.json']:
    dest = OUT / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / rel, dest)
(OUT / 'inventory.json').write_text(json.dumps(entries, indent=2))
(OUT / 'README.txt').write_text('Canonical Ducky Land assets, with identical files deduplicated. inventory.json records every source path.\nThe SVG library includes reusable items that may not be placed in the game world. Wardrobe files include source previews.\nArchived incoming/ builds and QA screenshots are excluded. Generated Rive scenery and animation remain in ducky-land.riv; they are not individual SVGs.\n')
html = r'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ducky Land · Asset library</title>
<style>
:root{font-family:system-ui,sans-serif;color:#203c31;background:#f7f5ef}*{box-sizing:border-box}body{margin:0}header{padding:48px max(24px,5vw) 28px;background:#e9edde;border-bottom:1px solid #d8dfd0}h1{font-size:clamp(32px,5vw,56px);letter-spacing:-2px;margin:8px 0}p{line-height:1.6;max-width:880px;color:#586d61}.eyebrow{font-size:12px;letter-spacing:2px;font-weight:700}a{color:#285a42}header a{display:inline-block;padding:12px 18px;border-radius:24px;background:#254e39;color:white;text-decoration:none;margin-top:8px}main{padding:28px max(24px,5vw)}.tools{display:flex;gap:12px;flex-wrap:wrap}input,select{font:inherit;border:1px solid #c9d2c6;border-radius:10px;padding:12px;background:white}input{flex:1;min-width:200px}#count{font-size:13px}#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px}article{background:white;border:1px solid #e1e5db;border-radius:14px;overflow:hidden;min-width:0}.preview{height:168px;display:flex;align-items:center;justify-content:center;background-color:#f4f5f0;background-image:linear-gradient(45deg,#e8ebe4 25%,transparent 25%),linear-gradient(-45deg,#e8ebe4 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e8ebe4 75%),linear-gradient(-45deg,transparent 75%,#e8ebe4 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0}img{width:90%;height:90%;object-fit:contain}audio{width:95%}.info{padding:14px}.name{font-size:14px;font-weight:650;overflow-wrap:anywhere}.meta{font-size:11px;color:#687969;margin:6px 0 12px}.links{font-size:12px;display:flex;gap:16px}.font{font-size:30px}.runtime{font-size:36px;font-weight:800}.empty{padding:40px}footer{padding:32px 0;color:#687969;font-size:12px}
</style><header><div class="eyebrow">🦆 DUCKY LAND / SOURCE COLLECTION</div><h1>Every little piece of the island.</h1><p id="summary"></p><p>Browse the game library, character views, wardrobe artwork, sounds, and fonts. Library items include reusable assets that may not appear in the world. Generated scenery and animations are bundled in the downloadable Rive file.</p><a href="../ducky-land-assets.zip" download>Download all assets ↓</a></header><main><div class="tools"><input id="search" type="search" placeholder="Search assets by name or source path…" aria-label="Search assets"><select id="category" aria-label="Asset category"><option value="">All categories</option></select></div><p id="count" aria-live="polite"></p><div id="grid"></div><footer>Identical files are deduplicated. Archived incoming builds and QA screenshots are excluded. Source paths and metadata are preserved in inventory.json.</footer></main><script>
const assets=__DATA__;
const grid=document.querySelector('#grid'),search=document.querySelector('#search'),category=document.querySelector('#category');
const imageExt=['.svg','.png','.jpg','.webp'];
const groups=[...new Set(assets.map(a=>a.category))].sort();
for(const name of groups){const o=document.createElement('option');o.value=name;o.textContent=name+' · '+assets.filter(a=>a.category===name).length;category.append(o)}
document.querySelector('#summary').textContent=assets.length+' unique files · '+groups.length+' categories · Original source files, ready to browse and download.';
function render(){const q=search.value.trim().toLowerCase();const filtered=assets.filter(a=>(!category.value||a.category===category.value)&&(!q||(a.name+' '+a.sources.join(' ')).toLowerCase().includes(q)));grid.replaceChildren();document.querySelector('#count').textContent=filtered.length+' of '+assets.length+' assets';for(const a of filtered){const card=document.createElement('article'),preview=document.createElement('div');preview.className='preview';const url=a.path.split('/').map(encodeURIComponent).join('/');if(imageExt.includes(a.extension)){const img=document.createElement('img');img.src=url;img.alt=a.name;img.loading='lazy';preview.append(img)}else if(a.extension==='.wav'){const player=document.createElement('audio');player.controls=true;player.preload='none';player.src=url;player.setAttribute('aria-label',a.name);preview.append(player)}else if(a.extension==='.ttf'){const sample=document.createElement('span');sample.className='font';sample.textContent='Ducky Aa 123';const family='assetfont'+assets.indexOf(a);const font=new FontFace(family,'url("'+url+'")');document.fonts.add(font);font.load().catch(()=>{});sample.style.fontFamily=family;preview.append(sample)}else{const label=document.createElement('span');label.className='runtime';label.textContent='RIVE';preview.append(label)}const info=document.createElement('div');info.className='info';const name=document.createElement('div');name.className='name';name.textContent=a.name;const meta=document.createElement('div');meta.className='meta';meta.textContent=a.category+' · '+a.extension.slice(1).toUpperCase()+' · '+Math.max(1,Math.round(a.bytes/1024))+' KB';meta.title=a.role+'\n'+a.sources.join('\n');const links=document.createElement('div');links.className='links';const open=document.createElement('a');open.href=url;open.target='_blank';open.rel='noopener';open.textContent='Open';const download=document.createElement('a');download.href=url;download.download=a.path.split('/').pop();download.textContent='Download ↓';links.append(open,download);info.append(name,meta,links);card.append(preview,info);grid.append(card)}}search.addEventListener('input',render);category.addEventListener('change',render);render();
</script></html>'''
(OUT / 'index.html').write_text(html.replace('__DATA__', json.dumps(entries).replace('</', '<\\/')))
with zipfile.ZipFile(ROOT / 'ducky-land-assets.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for p in OUT.rglob('*'):
        if p.is_file():
            archive.write(p, p.relative_to(ROOT))
print(json.dumps({'unique':len(entries),'source_files':len(files),'categories':dict(Counter(a['category'] for a in entries))},indent=2))
