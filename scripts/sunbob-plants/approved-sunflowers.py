"""Reuse HEAD's approved planter blossoms, without redrawing any flower."""
import json,re,subprocess,math
from pathlib import Path
A=Path('public/pixi-art/themes/sunflower')
src=subprocess.check_output(['git','show','HEAD:public/pixi-art/themes/sunflower/detail/planter.svg'],text=True)
# The original flowers and foliage sit entirely above the wooden box's soil line.
src=re.sub(r'height="322" viewBox="0 0 514 322"', 'height="178" viewBox="0 0 514 178"',src,count=1)
src=src.replace('Sunflower island: planter','Sunbob approved original planter blossoms')
(A/'detail/approved-sunflowers.svg').write_text(src)
replacements={'detail/field-row-short.svg':(180,180*178/514),'detail/field-flower.svg':(100,100*178/514)}
for file in [A/'art.json',Path('rive/web/themes/sunflower/world.json'),Path('rive/web/themes/sunflower/walk-world.json')]:
 d=json.loads(file.read_text()); kept=[]; boxes=[]; count=0
 for p in d.get('props',[]):
  old=p['src'];outer=p.get('id','').startswith('sunbob-outer-') and old.endswith('/sunflower-three.svg')
  if old in replacements or outer:
   w,h=replacements.get(old,(145,145*178/514));s=p.get('scale',1)
   # Keep each surviving placement's ground contact and original contact shadow.
   anchor=p.get('anchor',{'x':.5,'y':1});base=p['y']+(1-anchor['y'])*p['height']*s
   b=(p['x'],base,w,h)
   if any(abs(b[0]-q[0])<(w+q[2])*.55 and abs(b[1]-q[1])<(h+q[3])*.60 for q in boxes):count+=1;continue
   boxes.append(b);r=max(8,min(300,p['width']*s*.36))
   p.setdefault('shadowSize',[r,r*.3])
   p.update(src='detail/approved-sunflowers.svg',width=w/s,height=h/s,anchor=anchor)
  kept.append(p)
 if 'props' in d:d['props']=kept
 file.write_text(json.dumps(d,indent=1)+'\n');print(file,'thinned',count)
# Replace the new crop drawing within the curved fields with the same original art.
p=A/'bloom/plaza-curved-fields.svg';s=p.read_text()
inner=src[src.index('>')+1:src.rindex('</svg>')]
# Scoped viewport clips only the wooden box, retaining the original flower paths.
definition='<g id="crop"><ellipse cx="0" cy="1" rx="37" ry="8" fill="#3c5a2a" opacity=".15"/><svg x="-36" y="-25" width="72" height="24.93" viewBox="0 0 514 178" overflow="hidden">'+inner+'</svg></g>'
s=re.sub(r'<defs>.*?</defs>','<defs>'+definition+'</defs>',s,count=1,flags=re.S)
boxes=[]
def sparse(m):
 x,y=map(float,re.search(r'translate\(([-\d.]+) ([-\d.]+)\)',m[0]).groups())
 if any(abs(x-u)<89 and abs(y-v)<40 for u,v in boxes):return ''
 boxes.append((x,y));return m[0]
s=re.sub(r'<use href="#crop"[^>]*/>',sparse,s)
p.write_text(s);print('curved field flower clusters',len(boxes))
# Retired replacement art is no longer loaded or shipped.
for f in replacements:(A/f).unlink(missing_ok=True)
sizes=Path('src/pixi/art-source-sizes.json');d=json.loads(sizes.read_text())
for f in replacements:d.pop('/pixi-art/themes/sunflower/'+f,None)
print('size schema example',next(iter(d.items())))
d['/pixi-art/themes/sunflower/detail/approved-sunflowers.svg']=[514,178]
sizes.write_text(json.dumps(d,separators=(',',':'))+'\n')
