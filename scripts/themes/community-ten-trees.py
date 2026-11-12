"""Open sightlines around the campfire and separate crowded tree crowns.
Run after community-ten-ground.py and community-ten-benches.mjs.
"""
import json,math
from pathlib import Path
R=Path(__file__).resolve().parents[2];A=R/'public/pixi-art/themes/community';D=R/'assets/world/themes/community'
a=json.loads((A/'art.json').read_text());w=json.loads((D/'world.json').read_text());walk=json.loads((D/'walk-world.json').read_text());beds=json.loads((A/'resolved-sleepers.json').read_text())
trees=[p for p in a['props'] if 'tree' in p['name'].lower()]
def poly(x,y,pp):
 inside=False;j=len(pp)-1
 for i in range(len(pp)):
  if (pp[i][1]>y)!=(pp[j][1]>y) and x<(pp[j][0]-pp[i][0])*(y-pp[i][1])/(pp[j][1]-pp[i][1])+pp[i][0]:inside=not inside
  j=i
 return inside
def seg(x,y,p,q):
 dx=q[0]-p[0];dy=q[1]-p[1];t=max(0,min(1,((x-p[0])*dx+(y-p[1])*dy)/(dx*dx+dy*dy or 1)));return math.hypot(x-p[0]-t*dx,y-p[1]-t*dy)
segments=[(p,q,ww/2)for pts,ww in zip(w['paths'],w['pathWidths'])for p,q in zip(pts,pts[1:])]
def pathdist(x,y):return min(seg(x,y,p,q)-ww for p,q,ww in segments)
def crown(p,x=None,y=None):
 h=p['height']*p['scale'];return (p['x']if x is None else x,(p['y']if y is None else y)-h*.65,p['width']*p['scale']*.43,h*.28)
def overlap(p,x,y,q):
 cx,cy,rx,ry=crown(p,x,y);qx,qy,qr,qh=crown(q)
 return math.hypot((cx-qx)/(rx+qr),(cy-qy)/(ry+qh))
def masksplaza(p,x,y):
 cx,cy,rx,ry=crown(p,x,y)
 for key,z in w['zones'].items():
  if key not in ['plaza','voice-circle','member-wall'] and not key.startswith(('activity-','stalls-')):continue
  zx,zy=z['x'],z['y'];zr=z.get('rx',z.get('length',0)/2);zh=z.get('ry',z.get('depth',0)/2)
  if ((cx-zx)/(zr+rx))**2+((cy-zy)/(zh+ry))**2<1:return True
 return False

def legal(p,x,y):
 if not poly(x,y,w['coast']) or min(seg(x,y,z,w['coast'][(i+1)%len(w['coast'])])for i,z in enumerate(w['coast']))<145:return False
 if pathdist(x,y)<115 or masksplaza(p,x,y):return False
 if any(((x-z['x'])/(z['rx']+80))**2+((y-z['y'])/(z['ry']+70))**2<1 for z in w['sleepAvoid']):return False
 if any(seg(x,y,z['a'],z['b'])<180 for z in w['walkways']):return False
 if any(math.hypot(x-z['spawn'][0],y-z['spawn'][1])<150 for z in w['zones'].values()):return False
 h=p['height']*p['scale'];ww=p['width']*p['scale']
 if any(math.hypot(x-b['x'],y-b['y'])<300 or (y>b['y']-10 and y-h*.9<b['y'] and abs(x-b['x'])<ww*.5+45)for b in beds):return False
 if any(overlap(p,x,y,q)<.98 for q in trees if q!=p):return False
 for q in a['props']:
  if q in trees or any(t in q['name'].lower()for t in ['flower','bush','hedge','butterfly','rock','reeds']):continue
  if math.hypot(x-q['x'],y-q['y'])<130:return False
  if q['width']*q['scale']>200 and abs(x-q['x'])<(ww+q['width']*q['scale'])*.4 and y>q['y']-30 and y-h*.8<q['y']:return False
 return True
moves=[];unresolved=[]
# Fixed sleeper trees keep their roots, all candidates are deterministic.
for p in trees:
 if p['id'].startswith('nod-tree') or 'islet' in p['id']:continue
 bad=masksplaza(p,p['x'],p['y']) or any(overlap(p,p['x'],p['y'],q)<.95 for q in trees if q!=p)
 if not bad:continue
 ox,oy=p['x'],p['y'];found=None
 for radius in [80,140,220,300,400,520,650,800,1050,1300,1600,1900,2200]:
  for i in range(24):
   t=math.tau*i/24;x=round(ox+math.cos(t)*radius);y=round(oy+math.sin(t)*radius)
   if legal(p,x,y):found=(x,y);break
  if found:break
 if not found:
  oldscale=p['scale']
  for factor in [.9,.8,.7]:
   p['scale']=oldscale*factor
   for radius in [0,80,140,220,300,400,520,650,800,1050,1300,1600,1900,2200]:
    for i in range(24):
     t=math.tau*i/24;x=round(ox+math.cos(t)*radius);y=round(oy+math.sin(t)*radius)
     if legal(p,x,y):found=(x,y);break
    if found:break
   if found:break
  if not found:
   grid=sorted([(x,y)for y in range(900,4400,90)for x in range(1200,6900,90)],key=lambda xy:(xy[0]-ox)**2+(xy[1]-oy)**2)
   for factor in [.7,.6]:
    p['scale']=oldscale*factor
    for x,y in grid:
     if legal(p,x,y):found=(x,y);break
    if found:break
  if not found:p['scale']=oldscale;unresolved.append(p['id']);continue
 x,y=found
 for data in [w,walk]:
  for o in data['obstacles']:
   if o.get('x')==ox and abs(o.get('y',-9999)-oy)<30:o['x']+=x-ox;o['y']+=y-oy
 p.update(x=x,y=y);moves.append(dict(id=p['id'],before=[ox,oy],after=[x,y]))
# Small bushes and stones ground relocated trees without filling their walking lanes.
for i,m in enumerate(moves):
 x,y=m['after'];xx,yy=x-70,y+30
 if pathdist(xx,yy)>60 and all(math.hypot(xx-b['x'],yy-b['y'])>170 for b in beds):
  a['props'].append(dict(id=f'ten-root-bush-{i}',name='Low root bush',src='/pixi-art/plants/bush-2.svg',x=xx,y=yy,width=95,height=62,scale=1,anchor=dict(x=.5,y=1),zone='grove',flip=False))
  a['flats'].append(dict(src='detail/shore-rock.svg',x=x+62,y=y+19,width=42,height=27))
# Keep the centre collision contract in sync with its new ring seating.
c=json.loads((A/'centre/centre.json').read_text());c['blocked']=[]
for o in w['obstacles']:
 xx=sum(v[0]for v in o['poly'])/len(o['poly'])if'poly'in o else o['x'];yy=sum(v[1]for v in o['poly'])/len(o['poly'])if'poly'in o else o['y']
 if abs(xx-4000)<820 and abs(yy-2640)<700:c['blocked'].append({'poly':[[x-4000,y-2640]for x,y in o['poly']]}if'poly'in o else{'ellipse':{**o,'x':xx-4000,'y':yy-2640}})
(A/'centre/centre.json').write_text(json.dumps(c,indent=2)+'\n')
w['props']=a['props']
for p,v in [(A/'art.json',a),(D/'world.json',w),(D/'walk-world.json',walk),(D/'ten-tree-moves.json',dict(moves=moves,unresolved=unresolved))]:p.write_text(json.dumps(v,indent=2)+'\n')
print(json.dumps(dict(moved=len(moves),unresolved=unresolved)))
