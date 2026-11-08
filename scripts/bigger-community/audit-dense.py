"""Exact water/footprint intersections and measured village spacing for the report."""
from pathlib import Path
import json,sys,os,math
sys.path.insert(0,os.environ.get('DUCKY_COMMUNITY_PYTHON','/private/tmp/ducky-community-python'))
from shapely.geometry import Polygon,Point
from shapely.affinity import scale
from shapely.ops import unary_union
S=Path(__file__).resolve().parent
p=json.loads((S/'plan.json').read_text());before=json.loads((S/'dense-before-plan.json').read_text())
water=unary_union([Polygon(o['poly']) for o in p['reviewWater']]+[scale(Point(o['x'],o['y']).buffer(1,64),o['rx'],o['ry']) for o in p['markerBasins']])
checked=0;wet=[]
for home in p['homes']:
 for o in [o for o in p['obstacles'] if o['id']==home['id'] or o['id'].startswith(home['id']+'-fence')]:
  footprint=Polygon(o['poly']) if 'poly' in o else scale(Point(o['x'],o['y']).buffer(1,64),o['rx'],o['ry'])
  checked+=1
  if footprint.intersection(water).area>1:wet.append(o['id'])
def spacing(plan,name):
 homes=[h for h in plan['homes'] if h['community']==name]
 return sum(min(math.dist([h['x'],h['y']],[v['x'],v['y']]) for v in homes if v is not h) for h in homes)/len(homes)
result={'houseAndFenceFootprintsChecked':checked,'wetFootprints':wet,'neighbourhoods':[{'id':c['id'],'beforeMeanNearestHome':spacing(before,c['id']),'afterMeanNearestHome':spacing(p,c['id'])} for c in p['communities']]}
for key in ['coast','reviewWater','reviewBridges','reviewDecks','reviewRivers','reviewCommons','harbor']:assert p[key]==before[key],key+' changed'
assert not wet,wet
assert all(n['afterMeanNearestHome']<n['beforeMeanNearestHome']*.9 for n in result['neighbourhoods'])
(S/'dense-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
