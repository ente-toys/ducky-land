#!/usr/bin/env python3
"""Convert the checked-in island vector data to self-contained SVGs.

This is a static XML conversion. It never imports or executes the original
world/build generators and never loads a Rive runtime. Run from any directory:
    python3 scripts/extract-pixi-art.py
    python3 scripts/extract-pixi-art.py --check

RML's drawable siblings are top-first; SVG paints them in the opposite order.
Every path retains its original affine transform, cubic handles, fills,
strokes, rounded corners and intersections of clipping shapes. Prop (0, 0)
is the original ground contact point. All output is deterministic.
"""
from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
sys.dont_write_bytecode=True
from polish_svg import polish_svg,pigment,tint
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape, quoteattr

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/island-source/island.rml'
WORLD = ROOT / 'assets/world/world.json'
FONT = ROOT / 'assets/island-source/fonts/Gilroy-Black.ttf'
OUTPUT = ROOT / 'public/pixi-art'
MANIFEST = ROOT / 'src/pixi/art-manifest.json'
IDENTITY = (1., 0., 0., 1., 0., 0.)
DRAWABLES = {'Shape', 'Node', 'Text'}


def number(value):
    value = round(float(value), 6)
    return str(int(value)) if value.is_integer() else str(value)


def attr(node, name, default=0):
    return float(node.get(name, default))


def multiply(a, b):
    return (a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
            a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
            a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5])


def transform(node):
    a, sx, sy = attr(node, 'rotation'), attr(node, 'scaleX', 1), attr(node, 'scaleY', 1)
    return (math.cos(a)*sx, math.sin(a)*sx, -math.sin(a)*sy,
            math.cos(a)*sy, attr(node, 'x'), attr(node, 'y'))


def point(p, matrix):
    x, y = p
    return (matrix[0]*x+matrix[2]*y+matrix[4], matrix[1]*x+matrix[3]*y+matrix[5])


def matrix_svg(matrix):
    return 'matrix(' + ' '.join(number(v) for v in matrix) + ')'


def bounds_of(points):
    if not points:
        return None
    return [min(p[0] for p in points), min(p[1] for p in points),
            max(p[0] for p in points), max(p[1] for p in points)]


def union(boxes):
    boxes = [b for b in boxes if b is not None]
    return [min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes)] if boxes else None


def intersection(a, b):
    if a is None or b is None:
        return None
    result = [max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])]
    return result if result[2] >= result[0] and result[3] >= result[1] else None


def grow(bounds, amount):
    return [bounds[0]-amount, bounds[1]-amount, bounds[2]+amount, bounds[3]+amount] if bounds else None


def xy(p):
    return number(p[0]) + ' ' + number(p[1])


def path_data(node):
    """Return an SVG path and a conservative local control-point hull."""
    vertices = []
    for v in node:
        p = (attr(v, 'x'), attr(v, 'y'))
        incoming = outgoing = p
        if v.tag == 'CubicMirroredVertex':
            a, distance = attr(v, 'rotation'), attr(v, 'distance')
            delta = math.cos(a)*distance, math.sin(a)*distance
            incoming = p[0]-delta[0], p[1]-delta[1]
            outgoing = p[0]+delta[0], p[1]+delta[1]
        elif v.tag == 'CubicDetachedVertex':
            incoming = (p[0]+math.cos(attr(v, 'inRotation'))*attr(v, 'inDistance'),
                        p[1]+math.sin(attr(v, 'inRotation'))*attr(v, 'inDistance'))
            outgoing = (p[0]+math.cos(attr(v, 'outRotation'))*attr(v, 'outDistance'),
                        p[1]+math.sin(attr(v, 'outRotation'))*attr(v, 'outDistance'))
        elif v.tag != 'StraightVertex':
            raise ValueError(f'Unsupported vertex: {v.tag}')
        vertices.append({'p': p, 'in': incoming, 'out': outgoing,
                         'radius': attr(v, 'radius'), 'entry': p, 'exit': p, 'arc': None})
    if not vertices:
        return '', []
    closed = node.get('isClosed') == 'true'
    hull = [p for v in vertices for p in (v['p'], v['in'], v['out'])]
    for i, v in enumerate(vertices):
        if not v['radius'] or (not closed and i in (0, len(vertices)-1)):
            continue
        p, prev, nxt = v['p'], vertices[i-1]['p'], vertices[(i+1) % len(vertices)]['p']
        left = prev[0]-p[0], prev[1]-p[1]
        right = nxt[0]-p[0], nxt[1]-p[1]
        la, lb = math.hypot(*left), math.hypot(*right)
        if min(la, lb) < 1e-8:
            continue
        ua, ub = (left[0]/la, left[1]/la), (right[0]/lb, right[1]/lb)
        angle = math.acos(max(-1., min(1., ua[0]*ub[0]+ua[1]*ub[1])))
        tangent = math.tan(angle/2)
        if tangent < 1e-8 or angle > math.pi-1e-6:
            continue
        cut = min(v['radius']/tangent, la/2, lb/2)
        radius = cut*tangent
        v['entry'] = p[0]+ua[0]*cut, p[1]+ua[1]*cut
        v['exit'] = p[0]+ub[0]*cut, p[1]+ub[1]*cut
        v['arc'] = (radius, 1 if (-ua[0]*ub[1]+ua[1]*ub[0]) > 0 else 0)
        hull.extend([v['entry'], v['exit']])
    commands = ['M ' + xy(vertices[0]['entry'])]

    def corner(v):
        if v['arc']:
            r, sweep = v['arc']
            commands.append(f'A {number(r)} {number(r)} 0 0 {sweep} {xy(v["exit"])}')

    def segment(a, b):
        control_a = a['exit'] if a['arc'] else a['out']
        control_b = b['entry'] if b['arc'] else b['in']
        if control_a != a['exit'] or control_b != b['entry']:
            commands.append(f'C {xy(control_a)} {xy(control_b)} {xy(b["entry"])}')
        else:
            commands.append('L ' + xy(b['entry']))

    corner(vertices[0])
    for i in range(1, len(vertices)):
        segment(vertices[i-1], vertices[i])
        corner(vertices[i])
    if closed:
        segment(vertices[-1], vertices[0])
        commands.append('Z')
    return ' '.join(commands), hull


def color(paint):
    solid = paint.find('SolidColor')
    if solid is None:
        raise ValueError('Only solid paints are present in this island; unexpected paint found')
    argb = solid.get('colorValue').lstrip('#')
    if len(argb) == 6:
        argb = 'FF'+argb
    return '#'+argb[2:].lower(), int(argb[:2], 16)/255


class FontMetrics:
    """Read only TrueType metrics/cmap with the standard library; no font runtime."""
    def __init__(self, data):
        self.data = data
        table_count = struct.unpack_from('>H', data, 4)[0]
        self.tables = {}
        for i in range(table_count):
            tag, _checksum, offset, length = struct.unpack_from('>4sIII', data, 12+i*16)
            self.tables[tag.decode()] = data[offset:offset+length]
        self.units = struct.unpack_from('>H', self.tables['head'], 18)[0]
        self.ascent, self.descent = struct.unpack_from('>hh', self.tables['hhea'], 4)
        count = struct.unpack_from('>H', self.tables['hhea'], 34)[0]
        self.widths = [struct.unpack_from('>H', self.tables['hmtx'], i*4)[0] for i in range(count)]
        self.cmap = {}
        cmap = self.tables['cmap']
        for i in range(struct.unpack_from('>H', cmap, 2)[0]):
            _platform, _encoding, offset = struct.unpack_from('>HHI', cmap, 4+i*8)
            if struct.unpack_from('>H', cmap, offset)[0] != 4:
                continue
            segments = struct.unpack_from('>H', cmap, offset+6)[0]//2
            end_start, start_start = offset+14, offset+16+2*segments
            delta_start, range_start = start_start+2*segments, start_start+4*segments
            for j in range(segments):
                end = struct.unpack_from('>H', cmap, end_start+j*2)[0]
                start = struct.unpack_from('>H', cmap, start_start+j*2)[0]
                delta = struct.unpack_from('>h', cmap, delta_start+j*2)[0]
                range_offset = struct.unpack_from('>H', cmap, range_start+j*2)[0]
                for code in range(start, min(end+1, 0xffff)):
                    if range_offset:
                        at = range_start+j*2+range_offset+2*(code-start)
                        glyph = struct.unpack_from('>H', cmap, at)[0]
                        if glyph:
                            glyph = (glyph+delta) & 0xffff
                    else:
                        glyph = (code+delta) & 0xffff
                    self.cmap[code] = glyph
            break

    def width(self, text, size):
        return sum(self.widths[min(self.cmap.get(ord(c), 0), len(self.widths)-1)] for c in text)*size/self.units


class Board:
    def __init__(self, artboard, font_data, font_metrics, exclude_sea=False):
        self.artboard, self.font_data, self.font = artboard, font_data, font_metrics
        self.transforms, self.opacity, self.by_id, self.clips = {}, {}, {}, {}
        self.geometry, self.clip_defs, self.records = {}, {}, []
        self.has_text = False
        self.stats = {'paintedShapes': 0, 'paths': 0, 'clippingShapes': 0, 'textNodes': 0}

        def index(parent, matrix=IDENTITY, opacity=1, ancestor_clips=()):
            for child in parent:
                if child.tag not in DRAWABLES:
                    continue
                current = multiply(matrix, transform(child))
                alpha = opacity*attr(child, 'opacity', 1)
                self.transforms[child], self.opacity[child] = current, alpha
                current_clips = (*ancestor_clips, *(c.get('sourceId') for c in child.findall('ClippingShape')))
                self.clips[child] = current_clips
                if child.get('id'):
                    self.by_id[child.get('id')] = child
                if child.tag == 'Node':
                    index(child, current, alpha, current_clips)
        index(artboard)
        for node, matrix in self.transforms.items():
            if node.tag == 'Shape':
                paths, controls = [], []
                for path in node.findall('PointsPath'):
                    d, hull = path_data(path)
                    if d:
                        paths.append(d)
                    controls.extend(point(p, matrix) for p in hull)
                self.geometry[node] = (' '.join(paths), bounds_of(controls))
        for clip in artboard.iter('ClippingShape'):
            sid = clip.get('sourceId')
            source = self.by_id.get(sid)
            if source is None or source not in self.geometry:
                raise ValueError(f'Unresolved clipping source {sid} in {artboard.get("name")}')
            cid = 'clip-'+sid.replace(':', '-')
            d, _ = self.geometry[source]
            self.clip_defs[sid] = f'<clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d={quoteattr(d)} transform={quoteattr(matrix_svg(self.transforms[source]))}/></clipPath>'

        def render(parent):
            for node in reversed(list(parent)):
                if node.tag == 'Node':
                    render(node)
                elif node.tag == 'Shape':
                    if exclude_sea and node.get('name') == 'Sea':
                        continue
                    self.render_shape(node)
                elif node.tag == 'Text':
                    self.render_text(node)
        render(artboard)

    def render_shape(self, node):
        paints = [c for c in node if c.tag in {'Fill', 'Stroke'}]
        if not paints:
            return
        d, bounds = self.geometry[node]
        if not d:
            return
        matrix = self.transforms[node]
        max_scale = max(math.hypot(matrix[0], matrix[1]), math.hypot(matrix[2], matrix[3]))
        max_stroke = max((attr(p, 'thickness') for p in paints if p.tag == 'Stroke'), default=0)
        bounds = grow(bounds, max_stroke*max_scale/2)
        clips = self.clips[node]
        for sid in clips:
            bounds = intersection(bounds, self.geometry[self.by_id[sid]][1])
        if bounds is None:
            return
        parts = [f'<g data-name={quoteattr(node.get("name", "Shape"))} opacity="{number(self.opacity[node])}">']
        for sid in clips:
            parts.append(f'<g clip-path="url(#clip-{sid.replace(":", "-")})">')
        for paint in sorted(paints, key=lambda p: p.tag == 'Stroke'):
            rgb, alpha = color(paint)
            common = f'd={quoteattr(d)} transform={quoteattr(matrix_svg(matrix))}'
            if paint.tag == 'Fill':
                parts.append(f'<path {common} fill="{rgb}" fill-opacity="{number(alpha)}"/>')
            else:
                parts.append(f'<path {common} fill="none" stroke="{rgb}" stroke-opacity="{number(alpha)}" stroke-width="{number(attr(paint, "thickness"))}" stroke-linecap="{paint.get("cap", "butt")}" stroke-linejoin="{paint.get("join", "miter")}"/>')
        parts.extend('</g>' for _ in clips)
        parts.append('</g>')
        self.records.append((''.join(parts), bounds, clips, False))
        self.stats['paintedShapes'] += 1
        self.stats['paths'] += len(node.findall('PointsPath'))
        self.stats['clippingShapes'] += len(clips)

    def render_text(self, node):
        styles = {s.get('id'): s for s in node.findall('TextStylePaint')}
        runs = node.findall('TextValueRun')
        if not runs:
            return
        widths, sizes = [], []
        for run in runs:
            style = styles[run.get('styleId')]
            size = attr(style, 'fontSize', 24)
            sizes.append(size)
            widths.append(self.font.width(run.get('text', ''), size))
        width, size = sum(widths), max(sizes)
        top = -attr(node, 'originY')*(self.font.ascent-self.font.descent)*size/self.font.units
        left = -attr(node, 'originX')*width
        baseline = top+self.font.ascent*size/self.font.units
        height = (self.font.ascent-self.font.descent)*size/self.font.units
        matrix = self.transforms[node]
        bounds = bounds_of([point(p, matrix) for p in [(left, top), (left+width, top), (left+width, top+height), (left, top+height)]])
        clips = self.clips[node]
        for sid in clips:
            bounds = intersection(bounds, self.geometry[self.by_id[sid]][1])
        if bounds is None:
            return
        parts = [f'<g clip-path="url(#clip-{sid.replace(":", "-")})">' for sid in clips]
        parts.append(f'<text data-name={quoteattr(node.get("name", "Text"))} x="{number(left)}" y="{number(baseline)}" transform={quoteattr(matrix_svg(matrix))} font-family="DuckyGilroy" font-weight="900" opacity="{number(self.opacity[node])}">')
        for run, run_size in zip(runs, sizes):
            rgb, alpha = color(styles[run.get('styleId')].find('Fill'))
            parts.append(f'<tspan font-size="{number(run_size)}" fill="{rgb}" fill-opacity="{number(alpha)}">{escape(run.get("text", ""))}</tspan>')
        parts.append('</text>')
        parts.extend('</g>' for _ in clips)
        self.records.append((''.join(parts), bounds, clips, True))
        self.has_text = True
        self.stats['textNodes'] += 1

    def svg(self, view_box, title, cull=False):
        x, y, width, height = view_box
        tile_bounds = [x, y, x+width, y+height]
        records = [r for r in self.records if not cull or intersection(r[1], tile_bounds) is not None]
        used_clips = {sid for r in records for sid in r[2]}
        defs = [self.clip_defs[sid] for sid in sorted(used_clips)]
        if any(r[3] for r in records):
            encoded = base64.b64encode(self.font_data).decode('ascii')
            defs.append('<style>@font-face{font-family:DuckyGilroy;font-style:normal;font-weight:900;src:url(data:font/ttf;base64,'+encoded+') format("truetype")}</style>')
        parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{number(width)}" height="{number(height)}" viewBox="{" ".join(number(v) for v in view_box)}">',
                 '<title>'+escape(title)+'</title>',
                 '<desc>Original Ducky Land vector artwork, statically extracted from island.rml. Native ground-contact origin and painter order preserved.</desc>',
                 '<defs>'+''.join(defs)+'</defs>']
        parts.extend(r[0] for r in records)
        parts.append('</svg>\n')
        return '\n'.join(parts)


def cropped_view_box(board, padding=3):
    bounds = union([r[1] for r in board.records])
    if not bounds:
        raise ValueError('No visible geometry in '+board.artboard.get('name'))
    x, y = math.floor(bounds[0]-padding), math.floor(bounds[1]-padding)
    width, height = math.ceil(bounds[2]+padding)-x, math.ceil(bounds[3]+padding)-y
    return [x, y, width, height]


def continuous_footpaths(ground,world):
    paths=[path_data(node.find('PointsPath')) for node in ground.artboard.iter('Shape') if node.get('name')=='Footpath']
    links=['M1620 2970 C1690 2970 1750 2930 1820 2930',
           'M1490 1890 C1560 1870 1620 1800 1680 1760',
           'M2490 1360 C2650 1430 2780 1440 2920 1440',
           'M2920 1440 L3120 1300',
           'M3050 3080 L3200 3040',
           'M4150 2070 L4150 1910',
           'M3650 1240 L3660 1350',
           'M4740 1640 L5050 1640',
           'M1130 3080 C1180 2990 1260 2900 1350 2870',
           'M2320 3280 C2325 3220 2350 3170 2380 3130',
           'M3320 3335 L3320 3230',
           'M3940 3260 C3940 3170 3920 3120 3910 3070',
           'M2920 1440 L2920 1210']
    d=' '.join([path[0] for path in paths]+links)
    indices=[i for i,record in enumerate(ground.records) if 'data-name="Footpath' in record[0]]
    first=indices[0]
    ground.records[:]=[record for i,record in enumerate(ground.records) if i not in indices]
    paved_names={'Cream plaza','Race track sand','Lighthouse beach'}
    green_names={'Forest bread crumbs clearing','Library hill top','Library hill side'}
    background=f'<rect width="{world["width"]}" height="{world["height"]}" fill="white"/>'
    mask_box=f'maskUnits="userSpaceOnUse" x="0" y="0" width="{world["width"]}" height="{world["height"]}"'
    paved=[];green=[];race=[]
    for node in ground.geometry:
        if node.get('name') in paved_names:
            geometry,_=ground.geometry[node]
            paved.append(f'<path d="{geometry}" transform="{matrix_svg(ground.transforms[node])}" fill="black"/>')
        if node.get('name') in green_names:
            geometry,_=ground.geometry[node]
            green.append(f'<path d="{geometry}" transform="{matrix_svg(ground.transforms[node])}" fill="white"/>')
        if node.get('name')=='Race track grassy rim':
            geometry,_=ground.geometry[node]
            race.append(f'<path d="{geometry}" transform="{matrix_svg(ground.transforms[node])}" fill="white"/>')
    ground.clip_defs['race-paths']=f'<mask id="race-paths" {mask_box}><rect width="{world["width"]}" height="{world["height"]}" fill="black"/>{"".join(race)}</mask>'
    ground.clip_defs['green-paths']=f'<mask id="green-paths" {mask_box}><rect width="{world["width"]}" height="{world["height"]}" fill="black"/>{"".join(green)}</mask>'
    ground.clip_defs['paved-surfaces']=f'<mask id="paved-surfaces" {mask_box}>{background}{"".join(paved)}</mask>'
    ground.clip_defs['path-openings']=f'<mask id="path-openings" {mask_box}>{background}<path d="{d}" fill="none" stroke="black" stroke-width="115" stroke-linecap="round" stroke-linejoin="round"/></mask>'
    for i,record in enumerate(ground.records):
        if any(f'data-name="{name} Ink"' in record[0] for name in paved_names|green_names|{'Race track grassy rim'}):
            ground.records[i]=(f'<g mask="url(#path-openings)">{record[0]}</g>',record[1],(*record[2],'path-openings'),record[3])
    svg=f'<g data-name="Continuous footpaths" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="{d}" mask="url(#paved-surfaces)" stroke="#232323" stroke-width="119"/><path d="{d}" stroke="#fff4c5" stroke-width="115"/></g>'
    bounds=grow(bounds_of([point for _,points in paths for point in points]+[(5050,1640),(3940,3260),(1130,3080)]),60)
    ground.records.insert(first,(svg,bounds,('paved-surfaces',),False))
    above_green=max(i for i,record in enumerate(ground.records) if any(f'data-name="{name} Ink"' in record[0] for name in green_names))+1
    ground.records.insert(above_green,(f'<g mask="url(#green-paths)">{svg}</g>',bounds,('paved-surfaces','green-paths'),False))
    above_rim=next(i for i,record in enumerate(ground.records) if 'data-name="Race track grassy rim Ink"' in record[0])+1
    ground.records.insert(above_rim,(f'<g mask="url(#race-paths)">{svg}</g>',bounds,('paved-surfaces','race-paths'),False))


def boardwalk_depth(world):
    parts=[]
    for bridge in world['walkways']:
        ax,ay=bridge['a'];bx,by=bridge['b'];dx,dy=bx-ax,by-ay;length=math.hypot(dx,dy)
        nx,ny=dy/length*bridge['w']/2,-dx/length*bridge['w']/2
        top=[(ax-nx,ay-ny),(ax+nx,ay+ny),(bx+nx,by+ny),(bx-nx,by-ny)]
        polygon=lambda points:' '.join(number(x)+','+number(y) for x,y in points)
        parts.append(f'<polygon points="{polygon([(x+13,y+28) for x,y in top])}" fill="#245c69" opacity=".19"/>')
        for fraction in (.18,.5,.82):
            for side in (-1,1):
                x=ax+dx*fraction+nx*side*1.05;y=ay+dy*fraction+ny*side*1.05
                parts.append(f'<ellipse cx="{number(x+9)}" cy="{number(y+30)}" rx="13" ry="5" fill="#245c69" opacity=".18"/>')
                parts.append(f'<path d="M{number(x-6)} {number(y)} v31 l12 3 v-34Z" fill="#714323" stroke="#232323" stroke-width="1.5"/>')
        parts.append(f'<polygon points="{polygon([top[1],top[2],(top[2][0]+5,top[2][1]+15),(top[1][0]+5,top[1][1]+15)])}" fill="#89502c" stroke="#232323" stroke-width="1.6"/>')
        parts.append(f'<polygon points="{polygon([top[2],top[3],(top[3][0]+5,top[3][1]+15),(top[2][0]+5,top[2][1]+15)])}" fill="#a45f32" stroke="#232323" stroke-width="1.6"/>')
    return ('<g data-name="Boardwalk depth">'+''.join(parts)+'</g>',[0,0,world['width'],world['height']],(),False)


def exports():
    source_bytes, world_bytes, font_data = SOURCE.read_bytes(), WORLD.read_bytes(), FONT.read_bytes()
    root, world, font_metrics = ET.fromstring(source_bytes), json.loads(world_bytes), FontMetrics(font_data)
    artboards = {a.get('name'): a for a in root.findall('Artboard')}
    if len(world['props']) != 83:
        raise ValueError('Expected the original 83 island props')
    output = {}
    enhanced_assets={}
    library=json.loads((ROOT/'assets/manifest.json').read_text())
    for asset in library['assets']:
        file='detail/'+asset['file'].removeprefix('assets/').replace('/','--')
        output[OUTPUT/file]=polish_svg((ROOT/asset['file']).read_text(),asset['name'])
        enhanced_assets[asset['file']]='/pixi-art/'+file
    rowboat = ET.parse(ROOT/'assets/water/rowboat.svg').getroot()
    for path in list(rowboat):
        if '-oar-' in path.get('id',''):
            rowboat.remove(path)
    output[OUTPUT/'rowing-hull.svg'] = polish_svg(ET.tostring(rowboat, encoding='unicode'), 'rowboat')
    floating=[]
    for i,node in enumerate(list(artboards['Island Ground'])):
        if node.get('name')!='Pond lily':continue
        x,y=attr(node,'x'),attr(node,'y')
        board_root=ET.Element('Artboard',{'name':f'Floating lily {i}'})
        local=copy.deepcopy(node);local.set('x','0');local.set('y','0');board_root.append(local)
        board=Board(board_root,font_data,font_metrics);box=cropped_view_box(board);vx,vy,w,h=box
        file=f'lily-{len(floating):02d}.svg'
        output[OUTPUT/file]=polish_svg(board.svg(box,'Floating pond lily'),'lily')
        floating.append({'src':'/pixi-art/'+file,'x':x,'y':y,'width':w,'height':h,'anchor':{'x':-vx/w,'y':-vy/h},'phase':len(floating)*2.399963})
        artboards['Island Ground'].remove(node)
    water_texture='<g fill="none"><path d="M-20 36 C25 10 70 9 98 32 S160 62 193 32 S241 6 276 36 M-20 111 C18 138 68 131 96 106 S154 78 194 110 S244 140 276 111 M98 32 C125 60 66 80 96 106 M193 32 C163 60 223 83 194 110" stroke="#e3fbff" stroke-width="1.5" opacity=".16"/><path d="M25 73 Q39 68 53 73 M153 145 Q169 140 187 145 M215 72 Q229 77 242 72" stroke="#f0ffff" stroke-width="1.8" opacity=".3"/><path d="M4 151 Q27 144 43 151 M131 10 Q145 17 161 10" stroke="#285e82" stroke-width="1.2" opacity=".08"/></g>'
    output[OUTPUT/'water-texture.svg']='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="160" viewBox="0 0 256 160">'+water_texture+'</svg>\n'
    ground = Board(artboards['Island Ground'], font_data, font_metrics, exclude_sea=True)
    ground.clip_defs['lake-texture']='<pattern id="lake-texture" patternUnits="userSpaceOnUse" width="256" height="160">'+water_texture+'</pattern>'
    for i,record in enumerate(ground.records):
        if not any(f'data-name="{name}"' in record[0] for name in ('Lake water','Lake water Lit')):continue
        element=ET.fromstring(record[0]);keys=[]
        parents={child:parent for parent in element.iter() for child in parent}
        for painted in list(element.iter('path')):
            rgb=pigment(painted.get('fill',''))
            if not rgb:continue
            key='water-depth-'+''.join(f'{c:02x}' for c in rgb)
            stops=''.join(f'<stop offset="{offset}" stop-color="{tint(rgb,amount)}"/>' for offset,amount in [('0%',.17),('40%',0),('100%',-.24)])
            ground.clip_defs[key]=f'<linearGradient id="{key}" x1="0%" y1="0%" x2="75%" y2="100%">{stops}</linearGradient>'
            painted.set('fill',f'url(#{key})');keys.append(key)
            texture=copy.deepcopy(painted);texture.set('fill','url(#lake-texture)');texture.set('stroke','none');parent=parents[painted];parent.insert(list(parent).index(painted)+1,texture);keys.append('lake-texture')
        ground.records[i]=(ET.tostring(element,encoding='unicode'),record[1],(*record[2],*keys),record[3])
    ground.clip_defs['boardwalk-grain']='<pattern id="boardwalk-grain" patternUnits="userSpaceOnUse" width="36" height="12"><path d="M-5 3 C7 0 19 7 41 2 M-4 10 C12 6 22 13 40 8" fill="none" stroke="#704122" stroke-width=".7" opacity=".22"/></pattern>'
    for i,record in enumerate(ground.records):
        timber=any(f'data-name="{name}"' in record[0] for name in ('Boardwalk plank','Boardwalk plank Lit'))
        stone=any(f'data-name="{name}"' in record[0] for name in ('Hill stair','Hill stair Lit'))
        if not timber and not stone:continue
        element=ET.fromstring(record[0]);keys=[]
        for parent in list(element.iter()):
            for painted in list(parent):
                rgb=pigment(painted.get('fill',''))
                if painted.tag!='path' or not rgb:continue
                key='ground-material-'+''.join(f'{c:02x}' for c in rgb)
                stops=''.join(f'<stop offset="{offset}" stop-color="{tint(rgb,amount)}"/>' for offset,amount in [('0%',.23),('45%',.03),('100%',-.18)])
                ground.clip_defs[key]=f'<linearGradient id="{key}" x1="0%" y1="0%" x2="0%" y2="100%">{stops}</linearGradient>'
                painted.set('fill',f'url(#{key})');keys.append(key)
                if timber:
                    grain=copy.deepcopy(painted);grain.set('fill','url(#boardwalk-grain)');grain.set('stroke','none');parent.insert(list(parent).index(painted)+1,grain);keys.append('boardwalk-grain')
        ground.records[i]=(ET.tostring(element,encoding='unicode'),record[1],(*record[2],*keys),record[3])
    continuous_footpaths(ground,world)
    first_plank=next(i for i,record in enumerate(ground.records) if 'data-name="Boardwalk plank' in record[0])
    ground.records.insert(first_plank,boardwalk_depth(world))
    width, height = world['width'], world['height']
    ground_box = [0, 0, width, height]
    output[OUTPUT/'ground.svg'] = ground.svg(ground_box, 'Ducky Land — original island ground')
    tiles = []
    for row in range(3):
        for col in range(4):
            x, y = round(col*width/4), round(row*height/3)
            tw, th = round((col+1)*width/4)-x, round((row+1)*height/3)-y
            file = f'ground-r{row}-c{col}.svg'
            view_box = [x, y, tw, th]
            output[OUTPUT/file] = ground.svg(view_box, f'Ducky Land ground tile {row+1}, {col+1}', cull=True)
            tiles.append({'src': '/pixi-art/'+file, 'x': x, 'y': y, 'width': tw, 'height': th, 'viewBox': view_box})
    props = []
    for i, prop in enumerate(world['props']):
        board = Board(artboards[prop['artboard']], font_data, font_metrics)
        view_box = cropped_view_box(board)
        x, y, w, h = view_box
        file = f'prop-{i:02d}.svg'
        stats=board.stats
        if prop['name']=='Little library':
            building=(ROOT/'assets/library-building.svg').read_text()
            svg_root=ET.fromstring(building)
            view_box=[float(n) for n in svg_root.get('viewBox').split()]
            names=[el.tag.split('}')[-1] for el in svg_root.iter()]
            stats={'paintedShapes':sum(names.count(tag) for tag in ('path','rect','circle','ellipse')),'paths':names.count('path'),'clippingShapes':names.count('clipPath'),'textNodes':names.count('text')}
            x,y,w,h=view_box
            output[OUTPUT/file]=polish_svg(building,prop['name'])
        else:output[OUTPUT/file] = polish_svg(board.svg(view_box, prop['name']),prop['name'])
        props.append({'id': i, 'name': prop['name'], 'artboard': prop['artboard'], 'src': '/pixi-art/'+file,
                      'width': w, 'height': h, 'viewBox': view_box,
                      'anchor': {'x': -x/w, 'y': -y/h}, 'origin': {'x': -x, 'y': -y},
                      'bounds': {'minX': x, 'minY': y, 'maxX': x+w, 'maxY': y+h},
                      'x': prop['x'], 'y': prop['y'], 'scale': prop.get('scale', 1), 'zone': prop['zone'],
                      'stats': stats})
    manifest = {
        'schemaVersion': 1,
        'source': 'assets/island-source/island.rml',
        'overrides':{'Prop 34':'assets/library-building.svg'},
        'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
        'worldSource': 'assets/world/world.json',
        'worldSha256': hashlib.sha256(world_bytes).hexdigest(),
        'exporter': 'scripts/extract-pixi-art.py',
        'world': {'width': width, 'height': height},
        'coordinateConvention': 'Prop SVGs retain local ground-contact (0,0). Set sprite.anchor to anchor and position to (x,y); native dimensions are world units. Ground tiles use top-left anchors and their (x,y) positions.',
        'ground': {'src': '/pixi-art/ground.svg', 'width': width, 'height': height, 'viewBox': ground_box,
                   'transparent': True, 'excludedShape': 'Sea', 'tiles': tiles, 'stats': ground.stats},
        'props': props,
        'floating':floating,
        'enhancedAssets':enhanced_assets,
        'text': {'method': 'SVG text with embedded original Gilroy Black TrueType font', 'fontSource': 'assets/island-source/fonts/Gilroy-Black.ttf'},
    }
    output[MANIFEST] = json.dumps(manifest, indent=2, ensure_ascii=False)+'\n'
    return output, manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='verify deterministic generated files without writing')
    args = parser.parse_args()
    output, manifest = exports()
    mismatches = []
    for file, content in output.items():
        data = content.encode('utf8')
        if args.check:
            if not file.exists() or file.read_bytes() != data:
                mismatches.append(str(file.relative_to(ROOT)))
        else:
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
    if mismatches:
        print('Out-of-date generated artwork:\n'+'\n'.join(mismatches), file=sys.stderr)
        return 1
    total = sum(len(s.encode('utf8')) for s in output.values())
    verb = 'Verified' if args.check else 'Exported'
    print(f'{verb} 83 prop SVGs, transparent ground, 12 ground tiles, and manifest ({total:,} bytes).')
    print(f'Ground: {manifest["ground"]["stats"]}; maximum tile dimension: {max(max(t["width"],t["height"]) for t in manifest["ground"]["tiles"])}.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
