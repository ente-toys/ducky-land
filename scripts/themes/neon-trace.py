import sys, os, io, numpy as np, vtracer
from PIL import Image, ImageFilter
from collections import deque
OUT = os.path.join(os.path.dirname(__file__), '../../public/pixi-art/themes/neon')
INK = (43, 47, 79)
src, names = sys.argv[1], sys.argv[2].split(',')
opts = dict(a.split('=') for a in sys.argv[3:]); order = opts.get('order', 'lr'); K = int(opts.get('colors', 18))
im = Image.open(src).convert('RGB'); a = np.array(im).astype(int); H, W = a.shape[:2]
white = (a.min(-1) > 236) & ((a.max(-1) - a.min(-1)) < 14)
bg = np.zeros((H, W), bool); q = deque()
for x in range(W): q += [(0, x), (H-1, x)]
for y in range(H): q += [(y, 0), (y, W-1)]
while q:
    y, x = q.popleft()
    if 0 <= y < H and 0 <= x < W and white[y, x] and not bg[y, x]:
        bg[y, x] = True; q += [(y+1, x), (y-1, x), (y, x+1), (y, x-1)]
fg = ~bg
small = Image.fromarray((fg * 255).astype(np.uint8)).resize((W // 4, H // 4)).filter(ImageFilter.MaxFilter(int(opts.get('dil', 9))))
s = np.array(small) > 0; lab = np.zeros(s.shape, int); n = 0; boxes = []
for y0 in range(s.shape[0]):
    for x0 in range(s.shape[1]):
        if s[y0, x0] and not lab[y0, x0]:
            n += 1; q = deque([(y0, x0)]); lab[y0, x0] = n; ys = []; xs = []
            while q:
                y, x = q.popleft(); ys.append(y); xs.append(x)
                for yy, xx in ((y+1, x), (y-1, x), (y, x+1), (y, x-1)):
                    if 0 <= yy < s.shape[0] and 0 <= xx < s.shape[1] and s[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n; q.append((yy, xx))
            if len(ys) > 200: boxes.append((min(xs)*4, min(ys)*4, max(xs)*4+4, max(ys)*4+4, n))
if order == 'grid': boxes.sort(key=lambda b: (round((b[1]+b[3]) / 2 / (H/2.2)), b[0]))
else: boxes.sort(key=lambda b: b[0])
print(len(boxes), 'pieces', [b[:4] for b in boxes])
assert len(boxes) == len(names), f'{len(boxes)} pieces for {len(names)} names'
labbig = np.array(Image.fromarray(lab.astype(np.uint8)).resize((W, H), Image.NEAREST))
for (x0, y0, x1, y1, k), name in zip(boxes, names):
    if name.startswith('_'): continue
    m = fg & (labbig == k)
    pad = 6; x0, y0 = max(0, x0-pad), max(0, y0-pad); x1, y1 = min(W, x1+pad), min(H, y1+pad)
    crop = a[y0:y1, x0:x1]; mk = m[y0:y1, x0:x1]
    up = 2
    rgb = Image.fromarray(crop.astype(np.uint8)).resize(((x1-x0)*up, (y1-y0)*up), Image.LANCZOS).filter(ImageFilter.MedianFilter(5))
    mk2 = np.array(Image.fromarray((mk*255).astype(np.uint8)).resize(rgb.size, Image.LANCZOS)) > 127
    px = np.array(rgb).reshape(-1, 3).astype(float); sel = px[mk2.reshape(-1)]
    rng = np.random.default_rng(1); sel = sel[rng.choice(len(sel), min(len(sel), 60000), replace=False)]; C = sel[rng.choice(len(sel), K, replace=False)]; C[0] = INK
    for _ in range(12):
        idx = np.argmin(((sel[:, None] - C[None])**2).sum(-1), 1)
        for j in range(1, K):
            if (idx == j).any(): C[j] = sel[idx == j].mean(0)
    C[0] = INK
    dark = sel.sum(1) < 260
    lab2 = np.concatenate([np.argmin(((px[i:i+200000, None] - C[None])**2).sum(-1), 1) for i in range(0, len(px), 200000)]); lab2[px.max(1) < int(opts.get('ink', 90))] = 0
    lab2 = lab2.reshape(mk2.shape)
    lab2 = np.array(Image.fromarray(lab2.astype(np.uint8)).filter(ImageFilter.ModeFilter(5)))
    n = int(opts.get('thin', 0))
    for _ in range(n):
        ink = (lab2 == 0) & mk2
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nb = np.roll(np.roll(lab2, dy, 0), dx, 1); nbm = np.roll(np.roll(mk2, dy, 0), dx, 1)
            take = ink & nbm & (nb != 0)
            lab2 = np.where(take, nb, lab2); ink = ink & ~take
    if n: mk2 = np.array(Image.fromarray((mk2 * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(2 * n + 1))) > 127
    out = np.zeros(mk2.shape + (4,), np.uint8); out[..., :3] = C[lab2].astype(np.uint8); out[..., 3] = np.where(mk2, 255, 0)
    tmp = f'/tmp/_neon_{name}.png'; Image.fromarray(out).save(tmp)
    dst = f'{OUT}/{name}.svg'
    vtracer.convert_image_to_svg_py(tmp, dst, colormode='color', hierarchical='stacked', mode='spline', filter_speckle=10,
        color_precision=8, layer_difference=1, corner_threshold=60, length_threshold=6.0, max_iterations=10, splice_threshold=45, path_precision=1)
    sv = open(dst).read(); sv = sv.split('-->\n', 1)[-1]
    w, h = (x1-x0), (y1-y0)
    import re
    sv = re.sub(r'<svg[^>]*>', f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><title>Tickytown (neon): {name}</title><g transform="scale({1/up})">', sv, 1).replace('</svg>', '</g></svg>')
    open(dst, 'w').write(sv); os.remove(tmp)
    print(name, w, h, os.path.getsize(dst)//1024, 'KB')
