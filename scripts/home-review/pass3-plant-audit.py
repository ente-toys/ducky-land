"""Read-only clearance and preservation audit for the literal pass-3 gardens."""
import json,sys,os
from pathlib import Path
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import Point,LineString,Polygon
from shapely import affinity
from shapely.ops import unary_union
out=Path(os.environ['HOME_REVIEW_OUT'])
E=json.load(open('src/pixi/home-expansion.json'))
B=json.load(open(out/'before/home-expansion.json'))
assert [p for p in E['props'] if not str(p['id']).startswith('p3-')]==B['props'], 'previous props changed'
for key in E:
    if key!='props': assert E[key]==B[key], key
R=json.load(open('src/pixi/home-routes.json'))
paths=unary_union([LineString(r['samples']).buffer(r['width']/2) for r in R]+[Polygon(r['rings'][0],r['rings'][1:]) for r in E['roads'] if r.get('rings')])
water=unary_union([Polygon(w['poly']).buffer(0) for w in E['riverWater']]+[Polygon(E['water']['poly']).buffer(0),Polygon(json.load(open('src/pixi/walk-shapes.json'))['lake']).buffer(0),affinity.scale(Point(1640,2630).buffer(1,quad_segs=80),420,250)])
coast=Polygon(E['coast'])
rows=[]
for p in E['props']:
    if not str(p['id']).startswith('p3-'):continue
    q=Point(p['x'],p['y'])
    row=dict(id=p['id'],pathMargin=round(paths.distance(q),2),waterMargin=round(water.distance(q),2),coastMargin=round(coast.boundary.distance(q),2))
    assert paths.distance(q)>60,row
    assert not water.buffer(30).contains(q),row
    assert coast.buffer(-80).contains(q),row
    rows.append(row)
report=dict(newPlants=len(rows),priorPropsUnchanged=len(B['props']),allOtherExpansionFieldsUnchanged=True,minimumPathEdgeMargin=min(p['pathMargin'] for p in rows),minimumWaterMargin=min(p['waterMargin'] for p in rows),plants=rows)
(out/'plant-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('Plant audit:',len(rows),'plants;',report['minimumPathEdgeMargin'],'minimum path margin;',len(B['props']),'existing props unchanged')
