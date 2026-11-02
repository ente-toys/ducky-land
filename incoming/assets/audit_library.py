#!/usr/bin/env python3
"""Static deliverable checks and source measurements, not an aesthetic score."""
import json,collections,xml.etree.ElementTree as ET,math
from pathlib import Path
from build_library import ROOT,path,PAL,INK
from PIL import Image
import numpy as np
m=json.loads((ROOT/'assets/manifest.json').read_text());errors=[];colors=collections.Counter();paths=0;seen=set()
allowed={c.upper() for pair in PAL.values() for c in pair}|{INK,'#FFFFFF','#F4764E'}
for a in m['assets']:
    key=a['category']+'/'+a['name']
    if key in seen:errors.append('duplicate '+key)
    seen.add(key);r=ET.parse(ROOT/a['file']).getroot()
    w,h=a['size']['width'],a['size']['height']
    if r.get('viewBox')!=f'0 0 {w} {h}':errors.append('viewBox '+key)
    for e in r.iter():
        tag=e.tag.split('}')[-1]
        if tag not in ['svg','path','title','desc']:errors.append(f'{key}: forbidden element {tag}')
        if tag=='path':
            paths+=1;fill=e.get('fill','').upper();colors[fill]+=1
            if fill not in allowed:errors.append(f'{key}: outside palette {fill}')
            if set(e.attrib)-{'id','d','fill'}:errors.append(f'{key}: unsupported path attributes')
            p=path(e.get('d'));b=p.bounds
            if not len(p):errors.append(key+': empty path')
            if any(not math.isfinite(v) for v in b):errors.append(key+': nonfinite path')
            if b[0]<-.02 or b[1]<-.02 or b[2]>w+.02 or b[3]>h+.02:errors.append(key+': clipped path '+str(b))
    ax,ay=a['anchor']['x'],a['anchor']['y']
    if ax!=w/2 or not(0<=ay<=h):errors.append('anchor '+key)
    if not(ROOT/a['rml_fragment']).is_file():errors.append('missing RML '+key)
    if not(ROOT/'qa/rive'/a['category']/(a['name']+'.png')).is_file():errors.append('missing runtime render '+key)
counts=collections.Counter(a['category'] for a in m['assets'])
png=Image.open(ROOT/'reference/drip-source-4x.png').convert('RGBA')
ink_runs=[];start=None;row=430*4
for x in range(png.width):
    c=png.getpixel((x,row));b=c[:3]==(35,35,35) and c[3]==255
    if b and start is None:start=x
    if start is not None and (not b or x==png.width-1):
        if x-start>3:ink_runs.append({'x_start':start/4,'x_end':x/4,'width':(x-start)/4})
        start=None
src=Image.open(ROOT/'drip-reference.png').convert('RGBA');flat=Image.open(ROOT/'reference/drip-ducky-flat.png').convert('RGBA')
refdiff=float(np.abs(np.asarray(src).astype(float)-np.asarray(flat).astype(float)).mean())
actual=np.asarray(Image.open(ROOT/'pipeline-five/proof.png').convert('RGB')).astype(float)
expected=np.asarray(Image.open(ROOT/'pipeline-five/expected.png').convert('RGB')).astype(float)
proofdiff=float(np.abs(actual-expected).mean())
comparison=json.loads((ROOT/'qa/rive-pixel-comparison.json').read_text())
result={'assets':len(m['assets']),'paths':paths,'categories':dict(sorted(counts.items())),'svg_elements_allowed':['svg','title','desc','path'],'raster_images':0,'filters':0,'gradients':0,'masks_or_clip_paths':0,'svg_strokes':0,'fonts_or_text_elements':0,'colors':dict(colors),'errors':errors,'source_measurement':{'canvas':[713,937],'alpha_bounds_world_units':[v/4 for v in png.getbbox()],'solid_ink_runs_at_y_430':ink_runs,'left_body_ink_width_at_y_430':ink_runs[0]['width'],'right_body_ink_width_at_y_430':ink_runs[-1]['width'],'authored_ink_width':7.5,'plaza_scale':.24,'plaza_ink_width':1.8,'outline_to_source_canvas_width':7.5/713,'side_shade_width_fraction':.23,'white_streak_width_fraction':.025},'source_flatten_mean_rgba_difference_0_to_255':refdiff,'five_imports_mean_rgb_difference_0_to_255':proofdiff,'all_runtime_renders':comparison['count'],'maximum_asset_mean_rgb_difference_0_to_255':max(r['mean_absolute_rgb'] for r in comparison['results']),'maximum_asset_fraction_pixels_delta_gt_40':max(r['fraction_pixels_channel_delta_gt_40'] for r in comparison['results']),'two_axis_repeat_tiles':sum(a['repeat_axes']=='xy' for a in m['assets']),'one_axis_repeat_edges':sum(a['repeat_axes'] in ['x','y'] for a in m['assets']),'corner_connectors':sum(a['category']=='tiles' and not a['repeat_axes'] for a in m['assets'])}
(ROOT/'qa/audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
if errors:raise SystemExit(1)
