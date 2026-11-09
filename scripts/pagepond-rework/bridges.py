"""Direction-specific Pagepond timber bridges. No art rotation or shear.
EW and NS are separate drawings using the centre's wood palette and ink.
The longitudinal arch is vertical elevation only; the deck axis stays straight.
"""
import json,math
from pathlib import Path
A=Path('public/pixi-art/themes/library');file=Path('scripts/pagepond-rework/bridges.json');plan=json.loads(file.read_text())
INK='#39472d';WOOD='#C88941';DARK='#885931'
for c in plan['crossings']:
 ns=c['direction']=='ns';L,W,H=c['length'],c['width'],c['rise'];cx,cy=c['x'],c['y'];layers={'back':[],'front':[]};bounds={'back':[],'front':[]}
 def point(t,side=0,lift=0):
  crown=H*4*t*(1-t)
  # End-on NS perspective is drawn directly, with both ends centred on x.
  if ns:return [cx+side*(W/2*(.90+.10*t)+12*4*t*(1-t)),cy-L/2+t*L-crown-lift]
  return [cx-L/2+t*L,cy+side*W/2-crown-lift]
 def path(points,fill='none',stroke=INK,width=2.5,layer='back',closed=False):
  bounds[layer].extend(points);d='M'+'L'.join(f'{x:.3f} {y:.3f}' for x,y in points)+('Z' if closed else '')
  layers[layer].append(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>')
 ts=[i/40 for i in range(41)]
 # The dark timber rim follows the deck's actual elevated side profile.
 if ns:
  # Paired visible arch cheeks give the end-on view depth, without leaning
  # the bridge sideways. The centre of both landings stays on the NS axis.
  for side in [-1,1]:
   inner=[point(t,side) for t in ts]
   outer=[[x+side*(8+9*math.sin(math.pi*t)),y+12*math.sin(math.pi*t)] for t,(x,y) in zip(ts,inner)]
   path(inner+outer[::-1],DARK,closed=True)
 rim=[point(t,1) for t in ts]+[point(t,1,-12) for t in ts[::-1]]
 path(rim,DARK,closed=True)
 if ns:
  left=[point(t,-1) for t in ts];right=[point(t,1) for t in ts]
  path(left+right[::-1],WOOD,closed=True)
 else:path([point(t,-1) for t in ts]+[point(t,1) for t in ts[::-1]],WOOD,closed=True)
 if ns:
  # Flat painted bands and convex board seams describe the raised crown.
  for ta,tb,color in [(.17,.30,'#d79a4c'),(.30,.43,'#e4b35e'),(.43,.56,'#d99e4e'),(.78,1,'#bc7c38')]:
   band=[]
   for t,order in [(ta,range(17)),(tb,range(16,-1,-1))]:
    for j in order:
     side=j/8-1;x,y=point(t,side);band.append([x,y+10*math.sin(math.pi*t)*(1-side*side)])
   path(band,color,stroke='none',closed=True)
 for i in range(1,max(5,round(L/30))):
  t=i/max(5,round(L/30));board=[]
  for j in range(17):
   side=j/8-1;x,y=point(t,side);board.append([x,y+(10*math.sin(math.pi*t)*(1-side*side) if ns else 0)])
  path(board,width=1.7)
 # Two hand-drawn upright balustrades. Posts remain vertical in the camera.
 for side in [-1,1]:
  layer='front' if ns or side==1 else 'back'
  def rail(t,top):
   x,y=point(t,side,top)
   return [x+side*9,y] if ns else [x,y]
  for top in [30,43]:path([rail(t,top) for t in ts],stroke=INK,width=4.5,layer=layer);path([rail(t,top) for t in ts],stroke=WOOD,width=2,layer=layer)
  for i in range(7):
   t=i/6;post=[rail(t,-5),rail(t,47)];path(post,stroke=INK,width=7,layer=layer);path(post,stroke=WOOD,width=4,layer=layer)
 c['viewports']={}
 for layer,paths in layers.items():
  pts=bounds[layer];x=min(p[0] for p in pts)-5;y=min(p[1] for p in pts)-5;w=max(p[0] for p in pts)-x+5;h=max(p[1] for p in pts)-y+5
  svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{x} {y} {w} {h}" stroke-linecap="round" stroke-linejoin="round" data-source="canal-bridge-north" data-direction="{c["direction"]}" data-crossing="{c["id"]}"><title>Pagepond {c["direction"].upper()} arched timber bridge</title>'+''.join(paths)+'</svg>'
  (A/f'pagepond/{c["id"]}-{layer}.svg').write_text(svg);c['viewports'][layer]=[x,y,w,h]
file.write_text(json.dumps(plan,indent=2)+'\n')
