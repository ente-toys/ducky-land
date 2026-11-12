"""Validate and register the approved OG-scale building redraws without moving their bases."""
from pathlib import Path
import json,re,math,xml.etree.ElementTree as E,copy
ROOT=Path('../concepts/themes/work/pink-fix/buildings');A=Path('public/pixi-art/themes/pink');D=Path('assets/world/themes/pink')
read=lambda p:json.loads(Path(p).read_text())
def write(p,d):Path(p).write_text(json.dumps(d,indent=1)+'\n')
art=read(A/'art.json');world=read(D/'world.json');walk=read(D/'walk-world.json');layout=read('scripts/bigger-pink/layout.json')
report={'buildings':[],'supportingPieces':[],'skipped':[],'validatedSVGs':0}
for manifest in sorted(ROOT.glob('*/sizes.json')):
 hamlet=manifest.parent.name
 for filename,width in read(manifest).items():
  source=manifest.parent/filename;ref=f'hamlets/{hamlet}/{filename}';reason=None
  try:
   text=source.read_text();root=E.fromstring(text);vb=[float(x) for x in root.get('viewBox','').replace(',',' ').split()]
   if len(vb)!=4 or vb[2]<=0 or vb[3]<=0:reason='invalid viewBox'
   elif re.search(r'<(?:\w+:)?image\b|base64|(?:linear|radial)Gradient|filter\s*=|https?://(?!www.w3.org)',text,re.I):reason='raster, gradient or external content'
   elif re.search(r'\bstroke\s*=\s*"(?!none\b)[^"]+"',text) and '#39472d' not in text.lower():reason='missing #39472d outline ink'
  except Exception as e:reason=str(e)
  if reason:report['skipped'].append({'file':str(source),'reason':reason});continue
  target=A/ref;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text);report['validatedSVGs']+=1
  props=[p for category in ['props','flats'] for p in art[category] if p['src']==ref]
  for p in props:
   building=bool(p.get('household') or re.search(r'^(house-|cottage-|(?:pink|lilac|buttercream)-rose-cottage|ribbon-workshop|dovecote-workplace|workplace-teacup-cafe|tutu-tailor-workshop)',filename))
   if building and (width>520 or p.get('household') and not 420<=width<=480):report['skipped'].append({'file':str(source),'reason':'width outside the approved building range'});continue
   old=copy.deepcopy(p);oldw=p['width']*p.get('scale',1);k=width/oldw;x,y=p['x'],p['y']
   p.update(width=width,height=round(width*vb[3]/vb[2],3),scale=1,anchor={'x':.5,'y':1},redrawn=True)
   if building:p['shadow']=True
   def scaled(f):
    f=copy.deepcopy(f)
    if f.get('poly'):f['poly']=[[round(x+(q[0]-x)*k,3),round(y+(q[1]-y)*k,3)] for q in f['poly']]
    else:
     if 'x' in f:f['x']=round(x+(f['x']-x)*k,3)
     if 'y' in f:f['y']=round(y+(f['y']-y)*k,3)
     for key in ['rx','ry','w','h']:
      if key in f:f[key]=round(f[key]*k,3)
    return f
   for data in [world,walk]:
    for i,f in enumerate(data['obstacles']):
     if f.get('name')==p['id'] or (not f.get('name') and abs(f.get('x',1e9)-x)<2 and abs(f.get('y',1e9)-y)<100):data['obstacles'][i]=scaled(f)
   if p.get('footprint'):p['footprint']=scaled(p['footprint'])
   for key in ['door','entry','entrance']:
    if isinstance(p.get(key),list) and len(p[key])==2:p[key]=[round(x+(p[key][0]-x)*k,3),round(y+(p[key][1]-y)*k,3)]
   p['baseSpot']=[x,y]
   record={'id':p['id'],'hamlet':hamlet,'src':ref,'width':width,'oldWidth':oldw,'height':p['height'],'base':[x,y],'footprintScale':k,'door':p.get('door'),'shadowWidth':width*.36}
   report['buildings' if building else 'supportingPieces'].append(record)
world['props']=art['props'];walk['props']=art['props'];byid={p['id']:p for p in art['props']}
layout['props']=[byid.get(p['id'],p) for p in layout['props']];base=read('scripts/bigger-pink/original-world.json')['obstacles'];layout['baseObstacles']=[o for o in world['obstacles'] if o in base];layout['obstacles']=[o for o in world['obstacles'] if o not in base]
for path,data in [(A/'art.json',art),(D/'world.json',world),(D/'walk-world.json',walk),(Path('scripts/bigger-pink/layout.json'),layout)]:write(path,data)
write('scripts/pink-final/building-report.json',report)
print('Redraws:',len(report['buildings']),'buildings;',report['validatedSVGs'],'SVGs;',len(report['skipped']),'skipped')
