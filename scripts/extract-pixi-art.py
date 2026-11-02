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
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape, quoteattr

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'rive/island.rml'
WORLD = ROOT / 'rive/web/world.json'
FONT = ROOT / 'rive/fonts/Gilroy-Black.ttf'
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
                # Imported SVG masks can belong to a Node, not only a Shape.
                # Their source geometry remains in artboard coordinates while
                # every descendant drawable inherits the same intersection.
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
        # A native Shape's fill under stroke is preserved; sibling order is
        # reversed separately. Most shapes have one paint, cobbles have both.
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


def exports():
    source_bytes, world_bytes, font_data = SOURCE.read_bytes(), WORLD.read_bytes(), FONT.read_bytes()
    root, world, font_metrics = ET.fromstring(source_bytes), json.loads(world_bytes), FontMetrics(font_data)
    artboards = {a.get('name'): a for a in root.findall('Artboard')}
    if len(world['props']) != 83:
        raise ValueError('Expected the original 83 island props')
    output = {}
    ground = Board(artboards['Island Ground'], font_data, font_metrics, exclude_sea=True)
    width, height = world['width'], world['height']
    ground_box = [0, 0, width, height]
    output[OUTPUT/'ground.svg'] = ground.svg(ground_box, 'Ducky Land — original island ground')
    tiles = []
    # Each texture is comfortably below WebGL's common 4096 px ceiling.
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
        output[OUTPUT/file] = board.svg(view_box, prop['name'])
        props.append({'id': i, 'name': prop['name'], 'artboard': prop['artboard'], 'src': '/pixi-art/'+file,
                      'width': w, 'height': h, 'viewBox': view_box,
                      'anchor': {'x': -x/w, 'y': -y/h}, 'origin': {'x': -x, 'y': -y},
                      'bounds': {'minX': x, 'minY': y, 'maxX': x+w, 'maxY': y+h},
                      'x': prop['x'], 'y': prop['y'], 'scale': prop.get('scale', 1), 'zone': prop['zone'],
                      'stats': board.stats})
    manifest = {
        'schemaVersion': 1,
        'source': 'rive/island.rml',
        'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
        'worldSource': 'rive/web/world.json',
        'worldSha256': hashlib.sha256(world_bytes).hexdigest(),
        'exporter': 'scripts/extract-pixi-art.py',
        'world': {'width': width, 'height': height},
        'coordinateConvention': 'Prop SVGs retain local ground-contact (0,0). Set sprite.anchor to anchor and position to (x,y); native dimensions are world units. Ground tiles use top-left anchors and their (x,y) positions.',
        'ground': {'src': '/pixi-art/ground.svg', 'width': width, 'height': height, 'viewBox': ground_box,
                   'transparent': True, 'excludedShape': 'Sea', 'tiles': tiles, 'stats': ground.stats},
        'props': props,
        'text': {'method': 'SVG text with embedded original Gilroy Black TrueType font', 'fontSource': 'rive/fonts/Gilroy-Black.ttf'},
    }
    output[MANIFEST] = json.dumps(manifest, indent=2, ensure_ascii=False)+'\n'
    # A plain SVG/HTML review page, independent of any rendering engine.
    # It is useful for inspecting source parity before consuming the textures.
    images = [f'<image href="ground.svg" width="{width}" height="{height}"/>']
    for prop in sorted(props, key=lambda p: p['y']):
        vx, vy, pw, ph = prop['viewBox']
        s = prop['scale']
        images.append(f'<image href="{prop["src"].split("/")[-1]}" x="{number(prop["x"]+vx*s)}" y="{number(prop["y"]+vy*s)}" width="{number(pw*s)}" height="{number(ph*s)}"><title>{escape(prop["name"])}</title></image>')
    cards = [f'<figure><img src="{p["src"].split("/")[-1]}" alt={quoteattr(p["name"])}><figcaption>{p["id"]}: {escape(p["name"])}</figcaption></figure>' for p in props]
    output[OUTPUT/'preview.html'] = ('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Original Ducky Land SVG artwork</title>'
        '<style>body{margin:0;background:#7fd0f3;color:#232323;font:14px system-ui}nav{padding:8px 16px;background:#fff4c5}nav a{color:inherit;margin-right:24px}.map{display:block;width:100%;height:calc(100vh - 36px)}#catalog{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;padding:20px;background:#fff4c5}figure{margin:0;padding:10px;text-align:center;background:#fff9e1;border-radius:12px}figure img{width:100%;height:180px;object-fit:contain}figcaption{padding:8px}</style>'
        '<nav><a href="#map">Original island</a><a href="#catalog">83 vector props</a>Static SVG preview — no Rive runtime</nav>'
        f'<svg id="map" class="map" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">'+''.join(images)+'</svg>'
        '<div id="catalog">'+''.join(cards)+'</div></html>\n')
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
