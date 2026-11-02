#!/usr/bin/env python3
"""Check solid-colour continuity across repeat boundaries in vector space."""
import json,xml.etree.ElementTree as ET
from build_library import ROOT,path
m=json.loads((ROOT/'assets/manifest.json').read_text());tiles={a['name']:a for a in m['assets'] if a['category']=='tiles'}
geo={}
for name,a in tiles.items():
    r=ET.parse(ROOT/a['file']).getroot()
    geo[name]=[(path(e.get('d')),e.get('fill')) for e in r if e.tag.endswith('path')]
def at(name,x,y):
    for p,c in reversed(geo[name]):
        if p.contains((x,y)):return c
    return None
n=713;ep=.001
# Avoid sampling exactly on the authored half-unit colour transition itself.
# Path.contains has an intentionally unspecified side for an on-edge point.
samples=[(i+.37)*n/713 for i in range(713)]
result=[]
for name,a in tiles.items():
    for axis in a['repeat_axes']:
        bad=[]
        for t in samples:
            left,right=(at(name,ep,t),at(name,n-ep,t)) if axis=='x' else (at(name,t,ep),at(name,t,n-ep))
            if left!=right:bad.append(t)
        result.append({'name':name,'repeat_axis':axis,'samples':713,'mismatched_samples':len(bad),'mismatch_positions':bad})
corners=[]
for c in ['water-corner-nw','water-corner-ne','water-corner-se','water-corner-sw']:
    for edge in ['left','right','top','bottom']:
        sig=[at(c,ep,t) if edge=='left' else at(c,n-ep,t) if edge=='right' else at(c,t,ep) if edge=='top' else at(c,t,n-ep) for t in samples]
        candidates=[]
        for e in ['water-edge-north','water-edge-south','water-edge-east','water-edge-west','water','grass']:
            other=[at(e,n-ep,t) if edge=='left' else at(e,ep,t) if edge=='right' else at(e,t,n-ep) if edge=='top' else at(e,t,ep) for t in samples]
            mismatch=sum(a!=b for a,b in zip(sig,other))
            candidates.append((mismatch,e))
        best=min(candidates)
        corners.append({'corner':c,'edge':edge,'best_neighbour':best[1],'mismatched_samples':best[0]})
out={'method':'713 exact vector colour samples per boundary, 0.001 units inward. All layers are opaque.','repeat_boundaries':result,'corner_connections':corners,'pass':all(r['mismatched_samples']<=1 for r in result+corners)}
(ROOT/'qa').mkdir(exist_ok=True);(ROOT/'qa/tiling-check.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
if not out['pass']:raise SystemExit(1)
