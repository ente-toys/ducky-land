"""Reproject Pagepond's own arched timber, preserving flat fills and upright rail posts.
No new bridge drawing: source contours are the two centre bridge SVG layers.
The span and transverse deck width come from the actual bank intersections.
"""
import json, math, xml.etree.ElementTree as E
from pathlib import Path
from fontTools.svgLib.path import parse_path
from fontTools.pens.recordingPen import RecordingPen
A=Path('public/pixi-art/themes/library')
plan=json.load(open('scripts/pagepond/layout.json'))
source=[]
for name in ['canal-bridge-north.svg','canal-bridge-north-front.svg']:
 root=E.parse(A/name).getroot()
 for g in root.iter():
  group=g.get('id')
  if group not in ['far-railing','deck','front-fascia','near-railing']:continue
  for e in g:
   if not e.tag.endswith('path'):continue
   pen=RecordingPen();parse_path(e.get('d'),pen);source.append((group,e.attrib,pen.value))
for c in plan['crossings']:
 cs,sn=math.cos(c['angle']),math.sin(c['angle']);L,W=c['length'],c['width'];heightScale=L/472
 def project(p,group):
  x,y=p;t=max(0,min(1,(x-5016)/472));lift=75*math.sin(math.pi*t);v=y-(1636.6+(x-5016)*.1)+lift
  elevation=lift
  if group=='far-railing':elevation+=-57-v;v=-57
  elif group in ['near-railing','front-fascia']:elevation+=57-v;v=57
  v=max(-60,min(60,v))/60*W/2;u=(t-.5)*L
  return [c['x']+u*cs-v*sn,c['y']+u*sn+v*cs-elevation*heightScale]
 layers={'back':[],'front':[]};bounds={'back':[],'front':[]}
 for group,attrs,commands in source:
  d='';last=None;start=None
  def emit(p):
   q=project(p,group);bounds['front' if group=='near-railing' else 'back'].append(q);return ' '.join(f'{v:.3f}' for v in q)
  for op,pts in commands:
   if op=='moveTo':last=start=pts[0];d+='M'+emit(last)
   elif op=='lineTo':
    for p in pts:d+='L'+emit(p);last=p
   elif op in ['qCurveTo','curveTo']:
    # Source paths use explicit quadratic/cubic segments. Sample the nonlinear
    # camera reprojection so the original arch and rail curves stay intact.
    a=last
    for i in range(1,25):
     t=i/24;u=1-t
     if op=='qCurveTo':b,e=pts;p=tuple(u*u*a[k]+2*u*t*b[k]+t*t*e[k] for k in range(2))
     else:b,e,f=pts;p=tuple(u**3*a[k]+3*u*u*t*b[k]+3*u*t*t*e[k]+t**3*f[k] for k in range(2))
     d+='L'+emit(p)
    last=pts[-1]
   elif op=='closePath':d+='Z';last=start
   elif op=='endPath':pass
   else:raise ValueError(op)
  a={k:v for k,v in attrs.items() if k not in ['d','stroke-width']};a['d']=d
  if 'stroke-width' in attrs:a['stroke-width']=str(round(float(attrs['stroke-width'])*max(.7,heightScale),3))
  path=E.Element('path',a)
  layers['front' if group=='near-railing' else 'back'].append(E.tostring(path,encoding='unicode'))
 # Tight layer bounds avoid transparent margins being mistaken for tall props.
 c['viewports']={}
 for layer,paths in layers.items():
  pts=bounds[layer];x=min(p[0] for p in pts)-4;y=min(p[1] for p in pts)-4
  w=max(p[0] for p in pts)-x+4;h=max(p[1] for p in pts)-y+4
  root=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{x} {y} {w} {h}" stroke-linecap="round" stroke-linejoin="round" data-source="canal-bridge-north" data-crossing="{c["id"]}">' + ''.join(paths)+'</svg>'
  (A/f'pagepond/{c["id"]}-{layer}.svg').write_text(root)
  c['viewports'][layer]=[x,y,w,h]
Path('scripts/pagepond/layout.json').write_text(json.dumps(plan,indent=2)+'\n')
