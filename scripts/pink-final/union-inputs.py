"""Extract authored SVG geometry and exact placement transforms for vector floor unions."""
from pathlib import Path
import json,re,xml.etree.ElementTree as E
A=Path('public/pixi-art/themes/pink');art=json.loads((A/'art.json').read_text());ns='{http://www.w3.org/2000/svg}'
out={'pieces':[],'decorations':[]}
def mult(m,n):
 a,b,c,d,e,f=m;g,h,i,j,k,l=n;return [a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f]
def transform(s):
 m=[1,0,0,1,0,0]
 for kind,args in re.findall(r'([a-zA-Z]+)\(([^)]*)\)',s or ''):
  v=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',args)));n=[1,0,0,1,0,0]
  if kind=='matrix':n=v
  elif kind=='translate':n[4]=v[0];n[5]=v[1] if len(v)>1 else 0
  elif kind=='scale':n[0]=v[0];n[3]=v[1] if len(v)>1 else v[0]
  else:raise ValueError('Unsupported floor transform '+kind)
  m=mult(m,n)
 return m
def placement(p,r):
 vb=list(map(float,r.get('viewBox').replace(',',' ').split()));sx=p['width']/vb[2];sy=p['height']/vb[3];x=p['x']-(0 if p.get('topLeft') else p['width']/2);y=p['y']-(0 if p.get('topLeft') else p['height']);return [sx,0,0,sy,x-vb[0]*sx,y-vb[1]*sy]
def geometry(e):
 tag=e.tag.rsplit('}',1)[-1];a=e.attrib
 if tag=='path':return {'kind':'path','d':a['d']}
 if tag in ['ellipse','circle']:return {'kind':'ellipse','cx':float(a.get('cx',0)),'cy':float(a.get('cy',0)),'rx':float(a.get('rx',a.get('r',0))),'ry':float(a.get('ry',a.get('r',0)))}
 if tag=='rect':return {'kind':'rect','x':float(a.get('x',0)),'y':float(a.get('y',0)),'width':float(a['width']),'height':float(a['height']),'rx':float(a.get('rx',0))}
 return None
r=E.parse('scripts/pink-fix/art/paths.svg').getroot();lanes=next(e for e in r.iter() if e.get('id')=='lanes')
for i,e in enumerate(lanes):out['pieces'].append(dict(geometry(e),id=e.get('data-route','road-'+str(i)),role='road',stroke=160,matrix=[1,0,0,1,0,0]))
seen=set()
for p in art['flats']:
 src=p['src']
 if src.startswith('hamlets/') and '/paths' in src:
  r=E.parse(A/src).getroot();m=placement(p,r)
  def walk(e,inherit,matrix):
   if e.tag in [ns+'defs',ns+'clipPath']:return
   attrs=dict(inherit,**e.attrib);matrix=mult(matrix,transform(e.get('transform')))
   g=geometry(e)
   if g:
    fill=attrs.get('fill','black').lower();stroke=attrs.get('stroke','none').lower();width=float(attrs.get('stroke-width',0));sig=json.dumps([g,matrix,fill=='none',width if fill=='none' else 0],sort_keys=True)
    if sig not in seen and (fill=='#fbe6c8' and width==0 or fill=='none' and stroke=='#fbe6c8'):
     out['pieces'].append(dict(g,id=p['id']+'-'+str(len(out['pieces'])),role='hamlet-lane' if fill=='none' else 'hamlet-square',stroke=width if fill=='none' else 0,matrix=matrix));seen.add(sig)
   for c in e:walk(c,attrs,matrix)
  walk(r,{},m)
 elif p.get('id') in ['pink-close-cafe','pink-close-festival','pink-close-harbor'] or p.get('id') in ['hamlet-teacup-court','hamlet-tutu-tides-court']:
  r=E.parse(A/src).getroot();m=placement(p,r);shapes=[e for e in r.iter() if geometry(e)]
  if p.get('id')=='hamlet-tutu-tides-court':e=next(e for e in shapes if e.tag==ns+'path' and e.get('fill')=='#f0a6c7')
  else:e=shapes[0]
  g=dict(geometry(e),id=p['id'],role='plaza',stroke=0,matrix=mult(m,transform(e.get('transform'))))
  out['pieces'].append(g);out['decorations'].append({'prop':p,'shape':g,'matrix':m})
Path('scripts/pink-final/union-inputs.json').write_text(json.dumps(out,indent=1)+'\n')
print('Floor union inputs:',len(out['pieces']),'pieces and',len(out['decorations']),'decorative courts')
