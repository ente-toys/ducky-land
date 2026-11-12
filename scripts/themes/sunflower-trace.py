import sys, os, io, numpy as np, vtracer, cairosvg
from PIL import Image, ImageFilter
from scipy import ndimage as nd

sheet, out, names = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
opts = dict(a.split('=') for a in sys.argv[4:]); NC = int(opts.get('colors', 14)); UP = int(opts.get('up', 2))
os.makedirs(out, exist_ok=True)
im = Image.open(sheet).convert('RGB'); a = np.array(im).astype(int)
white = (a.min(-1) > 232)
lab, n = nd.label(white); border = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
bg = np.isin(lab, list(border))
sizes = nd.sum(white, lab, range(n + 1)); big = sizes > 3000; big[0] = False
bg |= big[lab]
fg = ~bg
fgd = nd.binary_dilation(fg, iterations=14)
blobs, nb = nd.label(fgd)
objs = nd.find_objects(blobs)
items = [(s, i + 1) for i, s in enumerate(objs) if (s[0].stop - s[0].start) * (s[1].stop - s[1].start) > 4000]
items.sort(key=lambda t: ((t[0][0].start + t[0][0].stop) // 2 // 200, t[0][1].start))
if len(items) != len(names): print('WARNING found', len(items), 'items, names', len(names), [ (s[0].start,s[1].start) for s,_ in items])
MODE = {k: int(v) for k, v in (t.split(':') for t in opts.get('mode', '').split(',') if t)}
LINES = {k: float(v) for k, v in (t.split(':') for t in opts.get('lines', '').split(',') if t)}
from skimage.morphology import skeletonize, disk
def thin_lines(c, px):
    a = c[..., 3] > 0; lum = c[..., :3].astype(float) @ [.3, .59, .11]
    dark = a & (lum < 90)
    e = nd.distance_transform_edt(dark)
    blob = nd.binary_dilation(e > 6.5, structure=disk(7)) & dark
    line = dark & ~blob
    r = max(1, int(round((px - 1) / 2)))
    keep = (nd.binary_dilation(skeletonize(line), structure=disk(r)) & line) | blob
    removed = dark & ~keep
    fill = a & ~dark
    d_fill, idx = nd.distance_transform_edt(~fill, return_indices=True)
    d_clear = nd.distance_transform_edt(a)
    out = c.copy()
    ys, xs = np.where(removed)
    to_clear = d_clear[ys, xs] < d_fill[ys, xs]
    out[ys[to_clear], xs[to_clear], 3] = 0
    ys2, xs2 = ys[~to_clear], xs[~to_clear]
    out[ys2, xs2, :3] = c[idx[0][ys2, xs2], idx[1][ys2, xs2], :3]
    return out
for (sl, idx), name in zip(items, names):
    y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
    mask = (blobs[y0:y1, x0:x1] == idx) & fg[y0:y1, x0:x1]
    rgb = np.array(im)[y0:y1, x0:x1]
    pad = 6
    H, W = mask.shape
    canvas = np.zeros((H + 2 * pad, W + 2 * pad, 4), np.uint8)
    canvas[pad:pad + H, pad:pad + W, :3] = rgb
    canvas[pad:pad + H, pad:pad + W, 3] = np.where(mask, 255, 0)
    img = Image.fromarray(canvas, 'RGBA')
    big = img.resize((img.width * UP, img.height * UP), Image.LANCZOS)
    alpha = np.array(big)[..., 3]
    rgbb = big.convert('RGB').filter(ImageFilter.MedianFilter(int(opts.get('median', 3))))
    q = rgbb.quantize(colors=NC, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q = q.filter(ImageFilter.ModeFilter(MODE.get(name, 5))).convert('RGB')
    qa = np.dstack([np.array(q), np.where(alpha >= 128, 255, 0).astype(np.uint8)])
    if name in LINES:
        qa = thin_lines(qa, LINES[name] * UP)
        al = np.array(Image.fromarray(qa[..., 3]).filter(ImageFilter.GaussianBlur(2.2))) >= 128
        sm = np.array(Image.fromarray(qa[..., :3]).quantize(colors=NC, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).filter(ImageFilter.ModeFilter(7)).convert('RGB'))
        qa = np.dstack([sm, np.where(al, 255, 0).astype(np.uint8)])
    tmp = f'{out}/_{name}.png'; Image.fromarray(qa, 'RGBA').save(tmp)
    dst = f'{out}/{name}.svg'
    vtracer.convert_image_to_svg_py(tmp, dst, colormode='color', hierarchical='stacked', mode='spline', filter_speckle=int(opts.get('speckle', 16)),
        color_precision=8, layer_difference=8, corner_threshold=60, length_threshold=5.0, max_iterations=10, splice_threshold=45, path_precision=1)
    s = open(dst).read()
    body = s[s.index('<path'):s.rindex('</svg>')] if '<path' in s else ''
    w, h = img.width, img.height
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><title>Sunflower island: {name}</title><g transform="scale({1/UP})">{body}</g></svg>'
    open(dst, 'w').write(svg); os.remove(tmp)
    print(name, w, h, os.path.getsize(dst) // 1024, 'KB')
