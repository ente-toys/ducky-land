# Centre plazas: vectorise one GPT piece (plain white background) into a game SVG sized in world units.
# venv: python3.11 -m venv vt && vt/bin/pip install vtracer cairosvg pillow numpy scipy scikit-image shapely
# usage: python centre-trace.py <src.png> <dst.svg> <world-height> [colors=16] [ink=2.6] [flip=1] [title=...]
#   world-height = drawn height in world units (one Ducky = 130). The SVG gets width/height in world units and a
#   viewBox in source pixels, so the engine can place it at its natural size.
#   ink = target outline weight in world units (home's line is ~2.2-2.6); thicker GPT ink is thinned to it.
import sys, os, numpy as np, vtracer
from PIL import Image, ImageFilter
from scipy import ndimage as nd
from skimage.morphology import skeletonize, disk

src, dst, WH = sys.argv[1], sys.argv[2], float(sys.argv[3])
opts = dict(a.split('=', 1) for a in sys.argv[4:])
NC = int(opts.get('colors', 22)); INK = float(opts.get('ink', 2.6)); FLIP = opts.get('flip') == '1'
im = Image.open(src).convert('RGB')
if FLIP: im = im.transpose(Image.FLIP_LEFT_RIGHT)
a = np.array(im).astype(int)
white = a.min(-1) > 236
lab, n = nd.label(white)
border = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
bg = np.isin(lab, list(border))
sizes = nd.sum(white, lab, range(n + 1)); big = sizes > int(opts.get("hole", 6000)); big[0] = False
bg |= big[lab]
fg = nd.binary_opening(~bg, iterations=1)
blobs, nb = nd.label(nd.binary_dilation(fg, iterations=10))
keep = np.zeros_like(fg)
areas = nd.sum(fg, blobs, range(nb + 1))
for i in range(1, nb + 1):
    if areas[i] > 0.01 * areas.max(): keep |= blobs == i
fg &= keep
ys, xs = np.where(fg); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
pad = 4
H, W = y1 - y0 + 2 * pad, x1 - x0 + 2 * pad
rgba = np.zeros((H, W, 4), np.uint8)
rgba[pad:-pad, pad:-pad, :3] = np.array(im)[y0:y1, x0:x1]
rgba[pad:-pad, pad:-pad, 3] = np.where(fg[y0:y1, x0:x1], 255, 0)
scale = WH / H                 # world units per source pixel
ink_px = INK / scale           # wanted ink width in source pixels

# strip the light anti-alias fringe round the silhouette (it reads as a white halo on grass)
al0 = rgba[..., 3] > 0
for _ in range(3):
    lumf = rgba[..., :3].astype(float) @ [.3, .59, .11]
    edge = al0 & ~nd.binary_erosion(al0)
    drop = edge & (lumf > 200) & (rgba[..., :3].max(-1).astype(int) - rgba[..., :3].min(-1) < 40)
    al0 &= ~drop
rgba[..., 3] = np.where(al0, 255, 0)
MED = int(opts.get('median', 5)); MODE = int(opts.get('mode', 7))
sm = np.array(Image.fromarray(rgba[..., :3]).filter(ImageFilter.MedianFilter(MED))).astype(int)
# palette = the image's own dominant flat colours (GPT art is flat), greedy by frequency, at least 22 apart
px = sm[rgba[..., 3] > 0]
keys, counts = np.unique((px // 6) * 6 + 3, axis=0, return_counts=True)
order = np.argsort(-counts); pal = []
for k in order:
    if counts[k] < px.shape[0] * 0.0004: break
    c = keys[k]
    if all(np.abs(c - p_).sum() > 22 * 3 / 2 for p_ in pal): pal.append(c)
    if len(pal) >= NC: break
pal = np.array(pal)
flat = sm.reshape(-1, 3); best = np.zeros(len(flat), int); bd = np.full(len(flat), 1e9)
for i, c in enumerate(pal):
    d = ((flat - c) ** 2).sum(1); m = d < bd; bd[m] = d[m]; best[m] = i
q = Image.fromarray(pal[best].reshape(sm.shape).astype(np.uint8)).filter(ImageFilter.ModeFilter(MODE))
qa = np.dstack([np.array(q), rgba[..., 3]])

# thin the ink to home's weight, keeping the silhouette: an outer outline keeps its outer ink_px, an inner line keeps
# ink_px round its skeleton, eyes and other solid dark blobs keep their shape; freed pixels take the nearest fill colour
alpha = qa[..., 3] > 0
lum = qa[..., :3].astype(float) @ [.3, .59, .11]
dark = alpha & (lum < 80)
e = nd.distance_transform_edt(dark)
sk = skeletonize(dark)
now_px = 2 * np.median(e[sk]) if dark.any() else 0
if now_px > ink_px * 1.2 and opts.get('thin', '1') == '1':
    d_clear = nd.distance_transform_edt(alpha)
    blob = nd.binary_dilation(e > max(now_px * .9, 7), structure=disk(4)) & dark
    outer = dark & (d_clear <= ink_px)
    inner_sk = sk & (d_clear > now_px + 1.5)
    r = max(1, int(round(ink_px / 2)))
    inner = nd.binary_dilation(inner_sk, structure=disk(r)) & dark
    kept = outer | inner | blob
    removed = dark & ~kept
    fill = alpha & ~dark
    d_fill, idx = nd.distance_transform_edt(~fill, return_indices=True)
    yy, xx = np.where(removed)
    qa[yy, xx, :3] = qa[idx[0][yy, xx], idx[1][yy, xx], :3]
print(os.path.basename(dst), f'ink {now_px:.1f}px -> {ink_px:.1f}px', end=' ')

tmp = dst + '.tmp.png'; Image.fromarray(qa, 'RGBA').save(tmp)
vtracer.convert_image_to_svg_py(tmp, dst, colormode='color', hierarchical='stacked', mode='spline', filter_speckle=12,
    color_precision=8, layer_difference=10, corner_threshold=60, length_threshold=4.0, max_iterations=10, splice_threshold=45, path_precision=1)
os.remove(tmp)
s = open(dst).read()
body = s[s.index('<path'):s.rindex('</svg>')]
title = opts.get('title', os.path.splitext(os.path.basename(dst))[0])
ww, hh = round(W * scale, 1), round(H * scale, 1)
open(dst, 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{ww}" height="{hh}" viewBox="0 0 {W} {H}">'
                     f'<title>{title}</title><desc>Original Ducky Land vector artwork, traced from a GPT piece in home style.</desc>{body}</svg>')
print(ww, hh, os.path.getsize(dst) // 1024, 'KB')
