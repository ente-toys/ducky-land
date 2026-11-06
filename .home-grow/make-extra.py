import json
PLANTS = {'tree-1': [260, 360], 'tree-2': [180, 360], 'tree-3': [300, 380], 'tree-4': [200, 280], 'tree-5': [150, 380],
          'bush-1': [130, 100], 'bush-2': [168, 110], 'bush-3': [116, 104], 'bush-4': [140, 100], 'bush-5': [170, 110], 'bush-6': [120, 96],
          'flower-1': [48, 36], 'flower-2': [48, 36], 'flower-3': [44, 36]}
PS = {'tree': 1.15, 'bush': 1.3, 'flower': 1.6}
def plant(pid, kind, x, y, k=1.0, flip=False, tint=None):
    w, h = PLANTS[kind]; fam = kind.split('-')[0]
    p = {'id': pid, 'name': {'tree': 'Tree', 'bush': 'Bush', 'flower': 'Flowers'}[fam], 'x': x, 'y': y, 'zone': 'grown', 'asset': kind,
         'src': '/pixi-art/plants/%s.svg' % kind, 'width': w, 'height': h, 'resolution': 5, 'anchor': {'x': .5, 'y': 1}, 'scale': PS[fam]}
    if fam == 'tree': p.update(scale=round(p['scale'] * 1.1 * k, 4), resolution=5.5, grow=1.1, tint=tint or 0xFFFFFF)   # sized(): SCALE_SHEET tree 1.1
    else: p['scale'] = round(p['scale'] * k, 4)
    if flip: p['flip'] = True
    return p
props = [
  # west rim
  plant('grow-tree-1', 'tree-5', 340, 1100, .95, tint=0xF4FAEC),        # a nod leans on it
  plant('grow-tree-2', 'tree-3', 300, 2150, .9, True),                  # a nod leans on it
  plant('grow-bush-1', 'bush-5', 255, 1690, 1.0),                        # beside the leaf nap
  plant('grow-bush-2', 'bush-6', 275, 2470, 1.0, True),                  # beside the rock nap
  # north-west shoulder
  plant('grow-bush-3', 'bush-2', 550, 975, .95, True),                   # beside the box nap
  plant('grow-flower-1', 'flower-3', 870, 1040),
  # north rim
  plant('grow-flower-2', 'flower-1', 2880, 250),                         # beside the wing nap
  plant('grow-tree-3', 'tree-2', 3270, 470, 1.0, False, 0xF4FAEC),       # the hammock hangs beside it
  plant('grow-tree-4', 'tree-4', 3800, 545, 1.0, True),                  # the reader's tree
  plant('grow-bush-4', 'bush-4', 4095, 500, 1.0),                        # beside the rock nap
  plant('grow-flower-3', 'flower-2', 4420, 560),
  # north-east
  plant('grow-tree-5', 'tree-1', 4760, 650, .95, False, 0xFFF7EA),       # beside the box nap
  # south-east bulge
  plant('grow-bush-5', 'bush-3', 4300, 3475, 1.0, True),                 # beside the leaf nap
]
json.dump({'note': 'boss 6 Nov: the trees, bushes and flowers on the land added round home (north, west, north-east). Same plant art and scale sheet as home (plant() + sized()), appended after consolidate() so no existing prop moves.', 'props': props}, open('rive/web/home-extra-props.json', 'w'), indent=1)
spots = {
  'nod': [['grow-tree-1', 0, False], ['grow-tree-2', 0, True]],
  'hammock': [[3050, 470, False]],
  'rock': [[4250, 520, True], [420, 2480, False]],
  'leaf': [[450, 1700, True], [4150, 3480, False]],
  'book': [[3600, 550, False]],
  'wing': [[330, 1400, False], [2720, 300, True]],
  'box': [[700, 1000, False], [4950, 780, True]],
}
open('rive/web/home-sleep-extra.json', 'w').write('{\n' + ',\n'.join('  %s: %s' % (json.dumps(k), json.dumps(v)) for k, v in spots.items()) + '\n}\n')
print(sum(len(v) for v in spots.values()))
