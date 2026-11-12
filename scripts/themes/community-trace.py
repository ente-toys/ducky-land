import sys, os, io, numpy as np, vtracer, cairosvg
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public/pixi-art/themes/community/detail')
INK = (57, 71, 45)

def kmeans(px, k, it=12, seed=3):
    rng = np.random.default_rng(seed)
    c = px[rng.choice(len(px), k, replace=False)].astype(float)
    for _ in range(it):
        lab = np.argmin(((px[:, None, :] - c[None]) ** 2).sum(-1), 1)
        for j in range(k):
            m = lab == j
            if m.any(): c[j] = px[m].mean(0)
    return c

def piece(im, box, name, k=13):
    q = np.array(im.crop(box).convert('RGB')).astype(int)
    white = (q.min(-1) > 236)
    lab, _ = ndimage.label(white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    pure = q.min(-1) > 244
    for i in np.unique(lab[pure]):
        if i and i not in border and (lab == i).sum() > 5000: bg |= lab == i
    fg = ndimage.binary_opening(~bg, iterations=1)
    fl, n = ndimage.label(fg)
    if n > 1:
        sizes = ndimage.sum(fg, fl, range(1, n + 1))
        edge = set(np.unique(np.concatenate([fl[0], fl[-1], fl[:, 0], fl[:, -1]])))
        keep = [i + 1 for i, s in enumerate(sizes) if s > .05 * sizes.max() and (i + 1 not in edge or s == sizes.max())]
        fg = np.isin(fl, keep)
    ys, xs = np.where(fg)
    y0, y1, x0, x1 = max(0, ys.min() - 6), min(q.shape[0], ys.max() + 7), max(0, xs.min() - 6), min(q.shape[1], xs.max() + 7)
    q, fg = q[y0:y1, x0:x1], fg[y0:y1, x0:x1]
    UP = 2
    img = Image.fromarray(q.astype(np.uint8)).resize((q.shape[1] * UP, q.shape[0] * UP), Image.LANCZOS).filter(ImageFilter.MedianFilter(5))
    rgb = np.array(img).astype(float)
    m = np.array(Image.fromarray((fg * 255).astype(np.uint8)).resize(img.size, Image.LANCZOS)) > 127
    px = rgb[m]
    pal = kmeans(px[::max(1, len(px) // 40000)], k)
    d = pal.sum(1).argmin(); pal[d] = INK
    labs = np.argmin(((rgb[..., None, :] - pal[None, None]) ** 2).sum(-1), -1).astype(np.uint8)
    labs = np.array(Image.fromarray(labs).filter(ImageFilter.ModeFilter(7)))
    ring = m & ~ndimage.binary_erosion(m, iterations=3)
    labs[ring] = d
    out = np.zeros(labs.shape + (4,), np.uint8); out[..., :3] = pal[labs].astype(np.uint8); out[..., 3] = np.where(m, 255, 0)
    work = os.path.abspath(os.path.join(ROOT, '..', 'concepts/themes/work/community/trace')); os.makedirs(work, exist_ok=True)
    tmp = os.path.join(work, f'_{name}.png'); Image.fromarray(out).save(tmp)
    dst = os.path.join(OUT, f'{name}.svg')
    vtracer.convert_image_to_svg_py(tmp, dst, colormode='color', hierarchical='stacked', mode='spline', filter_speckle=18,
                                    color_precision=8, layer_difference=1, corner_threshold=60, length_threshold=5.0,
                                    max_iterations=10, splice_threshold=45, path_precision=1)
    os.remove(tmp)
    s = open(dst).read()
    s = s.split('-->\n', 1)[-1]
    W, H = out.shape[1], out.shape[0]
    head = s[:s.index('>') + 1]
    s = s.replace(head, f'<svg xmlns="http://www.w3.org/2000/svg" width="{W // UP}" height="{H // UP}" viewBox="0 0 {W} {H}">'
                        f'<title>Campfire Commons: {name}</title><desc>Original Ducky Land vector artwork (community theme).</desc>', 1)
    open(dst, 'w').write(s)
    rows = np.where(fg.any(1))[0]; base = rows.max(); band = fg[max(0, base - int(.06 * fg.shape[0])):base + 1]
    bx = np.where(band.any(0))[0]
    ax, ay = .5, (base + 1) / fg.shape[0]
    print(f'{name}: {W // UP}x{H // UP} anchor=({ax:.3f},{ay:.3f}) {os.path.getsize(dst) // 1024}KB')
    return W // UP, H // UP, ax, ay

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    sheet = Image.open(sys.argv[1]); w, h = sheet.size
    boxes = [(0, 0, w // 2, h // 2), (w // 2, 0, w, h // 2), (0, h // 2, w // 2, h), (w // 2, h // 2, w, h)]
    for name, box in zip(sys.argv[2:6], boxes):
        if name != '-': piece(sheet, box, name)
