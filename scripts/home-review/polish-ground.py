"""One continuous Home ground drawing, sliced only after shoreline/path assembly.

The old centre tiles contained their own shore, roads and lake masks. Painting a
new surface over those left old contours visible at tile boundaries and mouths.
Every tile and the streaming fallback now read exactly the same drawing.
"""
import json, sys, re
from pathlib import Path
import xml.etree.ElementTree as ET
sys.path.insert(0, '/private/tmp/ducky-community-python')
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union
from shapely import affinity

E = json.loads(Path('src/pixi/home-expansion.json').read_text())
W = json.loads(Path('rive/web/world.json').read_text())

def contours(g):
    g=g.simplify(1,preserve_topology=True)
    polygons = [g] if g.geom_type == 'Polygon' else list(g.geoms)
    result=[]
    for p in polygons:
        for ring in [p.exterior,*p.interiors]:
            q=list(ring.coords)[:-1]
            # Local quadratic corners cannot overshoot a bank and create the
            # little cream hooks that an unconstrained Catmull spline can.
            import math
            corners=[]
            for i,b in enumerate(q):
                a=q[(i-1)%len(q)];c=q[(i+1)%len(q)]
                u=min(.35,20/max(.01,math.dist(a,b)));v=min(.35,20/max(.01,math.dist(c,b)))
                start=[b[k]+(a[k]-b[k])*u for k in (0,1)]
                end=[b[k]+(c[k]-b[k])*v for k in (0,1)]
                corners.append((start,b,end))
            d=f'M{corners[-1][2][0]:.2f},{corners[-1][2][1]:.2f}'
            for start,b,end in corners:
                d+=f'L{start[0]:.2f},{start[1]:.2f}Q{b[0]:.2f},{b[1]:.2f} {end[0]:.2f},{end[1]:.2f}'
            result.append(d+'Z')
    return ' '.join(result)

def soften(g, radius):
    return g.buffer(radius,quad_segs=12).buffer(-radius,quad_segs=12).simplify(.5,preserve_topology=True)

land = Polygon(E['coast']).buffer(0)
water = [Polygon(w['poly']).buffer(0) for w in E['riverWater']]+[Polygon(E['water']['poly']).buffer(0)]
pond = next(w for w in W['water'] if abs(w['x']-1640)<2)
water.append(affinity.scale(Point(pond['x'],pond['y']).buffer(1,quad_segs=80),pond['rx'],pond['ry']))
water.append(Polygon(json.loads(Path('src/pixi/walk-shapes.json').read_text())['lake']).buffer(0))
wet = soften(unary_union(water),35)
# Rounded inlet corners, no box clips crossing the sea and no pale strip across
# connected water. Shore and river bank are both boundaries of the same land.
sand = land.buffer(46,quad_segs=12).difference(wet).buffer(-24,quad_segs=12).buffer(24,quad_segs=12)
grass = land.difference(wet.buffer(26,quad_segs=12)).buffer(-20,quad_segs=12).buffer(20,quad_segs=12)
sd, gd, wd = map(contours,[sand,grass,wet])

# Keep the centre's familiar two-tone lawns. These are flat green shapes, with
# all former roads, hidden masks, sand pads and separate coasts excluded.
ET.register_namespace('', 'http://www.w3.org/2000/svg')
source=ET.parse('public/pixi-art/home-expansion/ground-r0-c0.svg').getroot()
lawns=next((ET.tostring(g,encoding='unicode') for g in source.iter() if g.get('data-name')=='Round 4 two-tone lawns'),'')
surface=Path('scripts/home-review/path-surface.svgfrag').read_text()
outer_file=Path('scripts/home-review/outer-meadows.svgfrag')
outer=outer_file.read_text() if outer_file.exists() else ''
g=f'''<defs><clipPath id="home-dry"><path d="{sd}" fill-rule="evenodd"/></clipPath><clipPath id="home-grass"><path d="{gd}" fill-rule="evenodd"/></clipPath><clipPath id="home-wet"><path d="{wd}"/></clipPath></defs>
<g data-name="Continuous Home shoreline" fill-rule="evenodd" stroke-linejoin="round">
<path d="{sd}" fill="#97dce5" stroke="#97dce5" stroke-width="13"/>
<path d="{sd}" fill="#e4c567" stroke="#e4c567" stroke-width="3"/>
<path d="{sd}" fill="#fde48c"/>
<path d="{gd}" fill="#93b72f"/>
</g><g clip-path="url(#home-grass)">{lawns}{outer}</g>
<g clip-path="url(#home-dry)">{surface}</g>'''
# Only water carries wavelets. The exact same connected water silhouette clips
# every one, including the harbour and east outlet.
wavefrag=Path('scripts/home-review/water-surface.svgfrag').read_text()
waves=re.search(r'<g fill="none" stroke="#bde8e6"[\s\S]*?</g>',wavefrag)
if waves:
    wave=waves[0].replace('url(#home-water-wet)','url(#home-wet)')
    g+=wave

def svg(box,w,h):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="'+ ' '.join(str(v) for v in box)+'">'+g+'</svg>'

# Keep all existing tile identifiers. Art is identical in overlapping core tiles
# too, so either texture can load first without exposing an obsolete rectangle.
tiles=E['tiles'][:]
original=json.loads(Path('src/pixi/art-manifest.json').read_text())
for t in original['ground']['tiles']:
    tiles += [dict(t,src=t['src']),dict(t,src=t['src'].replace('/pixi-art/','/pixi-art/home-expansion/'))]
sizes=json.loads(Path('src/pixi/art-source-sizes.json').read_text())
for t in tiles:
    # Bleed is real adjacent artwork, not a stretched copy of the tile. This
    # keeps shoreline geometry aligned at every zoom as Pixi overlaps tiles.
    w=t['width']+t.get('bleed',0);h=t['height']+t.get('bleed',0)
    Path('public'+t['src']).write_text(svg([t['x'],t['y'],w,h],w,h))
    sizes[t['src']]=[w,h]
sizes['/pixi-art/globe/home-ground.svg']=[1024,768]
Path('src/pixi/art-source-sizes.json').write_text(json.dumps(sizes,separators=(',',':'))+'\n')
fallback=svg([E['origin']['x'],E['origin']['y'],E['width'],E['height']],1024,768)
Path('public/pixi-art/globe/home-ground.svg').write_text(fallback)
manifestPath=Path('public/pixi-art/globe/manifest.json')
manifest=json.loads(manifestPath.read_text())
manifest['home']['groundBytes']=len(fallback.encode())
manifestPath.write_text(json.dumps(manifest,separators=(',',':'))+'\n')
Path('scripts/home-review/continuous-ground.svgfrag').write_text(g)

# The race lake keeps its spring, stones, reeds, lilies and boat. Remove its old
# separate ground/path/water background, now supplied by the continuous drawing.
lake=Path('public/pixi-art/lake-race.svg')
r=ET.parse(lake).getroot()
if len(r)>1 and r[0].tag.endswith('path'):
    details=r[1]
    for child in list(details)[:11]: details.remove(child)
    r.remove(r[0])
    lake.write_text(ET.tostring(r,encoding='unicode'))
print('Continuous ground:',len(tiles),'tile files + streaming fallback; organic sand components',len(sand.geoms) if hasattr(sand,'geoms') else 1)
