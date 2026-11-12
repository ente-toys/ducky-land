from pathlib import Path
import re,json
A=Path('public/pixi-art/themes/pink')
starts=[(8233,1840),(8480,2184),(8360,1030),(3168,5950),(4048,6110),(8630,2345)]
def obsolete(tag):
 m=re.search(r'd="M([-\d.]+)[, ]+([-\d.]+)',tag)
 return bool(m and any(abs(float(m[1])-x)<38 and abs(float(m[2])-y)<38 for x,y in starts) and len(tag)>1000)
mask='<mask id="hamlet-teacup-bypass" maskUnits="userSpaceOnUse" x="-3000" y="-2000" width="15000" height="12000"><rect x="-3000" y="-2000" width="15000" height="12000" fill="white"/><path d="M7100 850 L8360 1780 L8650 2300 L8200 3250" fill="none" stroke="black" stroke-width="230" stroke-linejoin="round" stroke-linecap="round"/></mask>'
changed=0
for f in (A/'expansion/tiles').glob('*.svg'):
 s=f.read_text();orig=s
 s=re.sub(r'<path\b[^>]*?/>',lambda m:'' if obsolete(m[0]) else m[0],s)
 s=s.replace('</defs>',mask+'</defs>',1)
 def clip(m):
  tag=m[0];q=re.search(r'd="M([-\d.]+)[, ]+([-\d.]+)',tag)
  if q and -450<float(q[1])<-250 and 500<float(q[2])<800 and len(tag)>10000: return tag.replace('/>',' mask="url(#hamlet-teacup-bypass)"/>')
  return tag
 s=re.sub(r'<path\b[^>]*?/>',clip,s)
 def decor(m):
  tag=m[0]
  xy=re.search(r'cx="([-\d.]+)" cy="([-\d.]+)"',tag) or re.search(r'd="M([-\d.]+)[, ]+([-\d.]+)',tag)
  if xy:
   x,y=map(float,xy.groups())
   if (7180<x<9780 and 680<y<3250) or (2910<x<5640 and 5250<y<6700):return ''
  return tag
 s=re.sub(r'<g clip-path="url\(#pink-roads\)">(.*?)</g>',lambda m: '<g clip-path="url(#pink-roads)">'+re.sub(r'<(?:path|ellipse)\b[^>]*?/>',decor,m[1])+'</g>',s,flags=re.S)
 if s!=orig:f.write_text(s);changed+=1
print('Updated road paint in',changed,'vector tiles; coast and sea data unchanged')
