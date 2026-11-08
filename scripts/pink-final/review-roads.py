"""Author the connected road graph used by both the pen drawing and navigation."""
from pathlib import Path
import json,subprocess,xml.etree.ElementTree as E
S=Path('scripts/pink-final');P=Path('scripts/pink-fix')
read=lambda p:json.loads(Path(p).read_text())
shore=read(P/'shore.json')
shore['crossings']=[c for c in shore['crossings'] if c['id'] not in ['rosewater-garden','rosewater-shore']]
for c in shore['crossings']:
 if c['id']=='willow-lane':c['a']=[7440,2650];c['b']=[7840,2430]
# The only western crossing is the promenade. Its ends are road vertices.
roads=[
 {'id':'promenade','points':[[-350,650],[1100,610],[2600,350],[4000,560],[5750,500],[7100,850],[8360,1780],[8650,2300],[8200,3250],[7870,3550],[7470,3860],[7170,4100],[6500,4000],[5740,4150],[5350,4800],[4840,5690],[4000,6100],[2600,5370],[1850,4900],[1440,4590],[1280,4510],[-450,3690],[-1640,2820],[-1450,1660],[-350,650]]},
 {'id':'marina','points':[[8650,2300],[9040,2470],[9350,2670],[9600,2850]]},
 {'id':'ribbonwick-centre','points':[[1043,1275],[760,1220],[618,978],[608,624]]},
 {'id':'petalpatch-centre','points':[[1124,2736],[900,2780],[0,2800],[-314,2700]]},
 {'id':'willow-centre','points':[[6865,2778],[7000,2700],[7440,2650],[7840,2430],[8650,2300]]},
 {'id':'chirrup-east','points':[[6362,894],[6860,760],[7100,850]]},
 {'id':'northwest-centre','points':[[3060,1050],[2760,560],[2600,350]]},
 {'id':'northeast-centre','points':[[4930,1120],[5500,630],[5750,500]]},
 {'id':'plaza-south-to-tutu','points':[[4000,3907],[4000,4380],[3500,4800],[3000,5000],[2600,5370]]},
 {'id':'chirrup-south','points':[[6250,500],[6250,667],[6362,894]]},
 {'id':'market-garden-link','points':[[5412,3250],[5420,3400]]},
 {'id':'south-east-garden','points':[[5567,3935],[5630,4090],[5740,4150]]},
 {'id':'teacup-arrival','points':[[6922,4434],[7060,4230],[7100,4070],[7170,4100]]},
 {'id':'tutu-west','points':[[3003,5839],[2800,5590],[2600,5370]]},
 {'id':'willow-coastal','points':[[8200,3250],[8560,3930],[8160,4330],[7700,4460],[7470,4300],[7170,4100]]}
]
bridgePairs={(tuple(c['a']),tuple(c['b'])) for c in shore['crossings']}|{(tuple(c['b']),tuple(c['a'])) for c in shore['crossings']}
def segments(points):
 n=len(points);closed=points[0]==points[-1];p=points[:-1] if closed else points;n=len(p);out=[]
 for i in range(n if closed else n-1):
  b=p[i];c=p[(i+1)%n];a=p[(i-1)%n] if closed or i else b;z=p[(i+2)%n] if closed or i+2<n else c
  # Bridge sills land exactly on the road, so the deck span stays straight.
  if (tuple(b),tuple(c)) in bridgePairs:out.append([b,b,c,c])
  else:out.append([b,[b[k]+(c[k]-a[k])/6 for k in range(2)],[c[k]-(z[k]-b[k])/6 for k in range(2)],c])
 return out
for r in roads:
 segs=segments(r['points']);r['d']='M'+' '.join(map(str,segs[0][0]))+''.join('C'+' '.join(f'{n:.2f}' for pt in s[1:] for n in pt) for s in segs)
 if r['points'][0]==r['points'][-1]:r['d']+='Z'
 r['sampled']=[]
 for a,b,c,d in segs:
  for j in range(12):
   t=j/12;r['sampled'].append([round((1-t)**3*a[k]+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k],2) for k in range(2)])
 r['sampled'].append(segs[-1][-1])
# Paint old and new lanes together: all shoulders first, then one shared cream surface.
# This prevents the old round end caps from remaining visible inside a joined road.
root=E.fromstring(subprocess.check_output(['git','show','96f36ed5:public/pixi-art/themes/pink/expansion/tiles/original-r2-c2.svg'],text=True));ns='{http://www.w3.org/2000/svg}'
core=next(e for e in root.iter() if e.get('data-name')=='Continuous footpaths')
corepaths=[e.get('d') for i,e in enumerate(core) if i not in [14,15]]
corepaths[12]='M3005 3206 C3040 3320 3140 3520 3166 3689'
xml='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2600 -1900 13200 9800"><defs><g id="lanes" fill="none" stroke-linecap="round" stroke-linejoin="round">'+''.join('<path data-route="centre-'+str(i)+'" d="'+d+'"/>' for i,d in enumerate(corepaths))+''.join('<path data-route="'+r['id']+'" d="'+r['d']+'"/>' for r in roads)+'</g></defs>'
for c,w,o in [('#39472d',178,'.6'),('#E6C59D',174,'1'),('#FBE6C8',160,'1')]:xml+=f'<use href="#lanes" fill="none" stroke="{c}" stroke-width="{w}" stroke-opacity="{o}"/>'
xml+='</svg>'
(P/'art/paths.svg').write_text(xml)
(S/'roads.json').write_text(json.dumps(roads,indent=1)+'\n');(P/'shore.json').write_text(json.dumps(shore,indent=1)+'\n')
