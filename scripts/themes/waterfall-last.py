"""Exact final Waterfall fixes. One visual round, no changes outside Waterfall."""
import json, math, re
from pathlib import Path
from shapely.geometry import Polygon
R=Path(__file__).resolve().parents[2]
A=R/'public/pixi-art/themes/waterfall'
O=R.parent/'concepts/themes/work/waterfall'
a=json.loads((A/'art.json').read_text())
w=json.loads((R/'assets/world/themes/waterfall/world.json').read_text())
backup=O/'last-waterfall-source.json'
if not backup.exists():
    backup.write_text(json.dumps({'art':a,'paving':(A/'centre/decal-paving.svg').read_text()},indent=2))
else:
    a=json.loads(backup.read_text())['art']
body=['<title>Locked waterfall lookout, golden timber deck over the pool</title>',
'<defs><clipPath id="deck"><ellipse rx="1150" ry="880.851"/></clipPath></defs>',
'<ellipse cy="16" rx="1150" ry="880.851" fill="#C88941" stroke="#39472D" stroke-width="4.6"/>',
'<ellipse rx="1150" ry="880.851" fill="#F4CF80" stroke="#39472D" stroke-width="4.6"/>',
'<g clip-path="url(#deck)">']
for i,y in enumerate(range(-920,920,82)):
    body.append(f'<rect x="-1160" y="{y}" width="2320" height="82" fill="{["#F4CF80","#F7D994","#EFC275"][i%3]}"/>')
    body.append(f'<path d="M-1160 {y}H1160" fill="none" stroke="#AF7E44" stroke-width="2.4"/><path d="M-1160 {y+5}H1160" stroke="#FFE7AC" stroke-width="3"/>')
    for x in range(-1250+(i%3)*190,1160,570):
        body.append(f'<path d="M{x} {y}v82" stroke="#B7894E" stroke-width="2.3"/><path d="M{x+22} {y+24}h135" stroke="#E5B56C" stroke-width="2.5" stroke-linecap="round"/>')
body+=['</g>','<ellipse rx="1126" ry="862.47" fill="none" stroke="#B7894E" stroke-width="4"/>','<ellipse rx="1146" ry="877.79" fill="none" stroke="#FFE7AC" stroke-width="5"/>']
(A/'centre/decal-paving.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="2310" height="1789.702" viewBox="-1155 -885.851 2310 1789.702">'+''.join(body)+'</svg>')
for p in a['flats']+a['props']:
    if not p.get('centrePiece'):continue
    pid=p['centrePiece']['id']
    if pid=='water-sheet' or pid.startswith(('flow-','impact-ripple-')) or pid=='foam':
        p['x']=3900+(p['x']-3900)*1.9
        p['width']*=1.9
        cp=p['centrePiece']
        cp['x']*=1.9;cp['width']*=1.9
        if 'at' in cp:cp['at'][0]*=1.9
        if cp.get('animate',{}).get('pivot'):cp['animate']['pivot'][0]*=1.9
ink='#39472D'
land=Polygon(w['coast']).buffer(-115)
def poly(p):
    return '<path d="M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in p.exterior.coords)+'Z"/>'
parts=['<title>Waterfall activity lawns, planted flower rims</title>', '<defs><clipPath id="grass">'+poly(land)+'</clipPath></defs><g clip-path="url(#grass)">']
counts={}
for key,z in w['zones'].items():
    if not key.startswith('activity-'):continue
    count=0
    for j in range(76):
        deg=j*360/76
        if min(abs(deg-v) for v in (0,180,360))<19:continue
        if key=='activity-3' and 65<deg<115:continue
        t=math.radians(deg)
        x=z['x']+z['rx']*.988*math.cos(t);y=z['y']+z['ry']*.988*math.sin(t)
        parts.append(f'<g transform="translate({x:.2f} {y:.2f})"><ellipse cx="-7" cy="3" rx="13" ry="7" fill="#3E9B42" stroke="{ink}" stroke-width="1.8"/><ellipse cx="8" cy="1" rx="12" ry="7" fill="#75BE47" stroke="{ink}" stroke-width="1.8"/>')
        for n in range(5):
            q=n*math.tau/5;dx=math.cos(q)*6;dy=math.sin(q)*5-5
            parts.append(f'<ellipse cx="{dx:.2f}" cy="{dy:.2f}" rx="4.8" ry="4.3" fill="{["#FFF5D5","#FFD65D","#F5A2B8"][j%3]}"/>')
        parts.append('<circle cy="-5" r="3.2" fill="#D99432"/></g>')
        count+=1
    counts[key]=count
parts.append('</g>')
(A/'detail/waterfall-last-lawn-flowers.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="7800" height="5800" viewBox="0 0 7800 5800">'+''.join(parts)+'</svg>')
a['flats'].append({'id':'waterfall-last-lawn-flowers','src':'detail/waterfall-last-lawn-flowers.svg','x':0,'y':0,'width':7800,'height':5800,'topLeft':True,'shadow':False})
(A/'art.json').write_text(json.dumps(a,indent=2)+'\n')
(O/'last-waterfall-changes.json').write_text(json.dumps({'flowerClusters':counts,'fallWidthBefore':217.92,'fallWidthAfter':414.048,'retained':'All 6 activity arc benches and 5 activity rim lamps; all world/walk geometry, zones, paths, trees, sleepers and other props unchanged.'},indent=2))
print(counts)
