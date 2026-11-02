"""Shared prop positions for the native scene and the crowd's navigation map."""
import json
from pathlib import Path

STALLS = [(330, 345, 'red', 1, 'fruit'), (800, 290, 'blue', 2, 'bakery'), (1270, 345, 'green', 3, 'flowers')]
BENCHES = [(215, 650, 'west-bench'), (1385, 650, 'east-bench')]
LAMPS = [(470, 420), (1130, 420), (330, 880), (1270, 880)]
FOUNTAIN = (800, 560)


def export():
    obstacles = []
    def circle(name, x, y, radius):
        obstacles.append(dict(name=name, x=x, y=y, radius=radius))
    # Circles are measured on the ground plane: y is stretched by 1.65.
    for x, y, r in [(680, 565, 128), (800, 565, 170), (920, 565, 128), (800, 603, 130)]:
        circle('fountain', x, y, r)
    stalls, seats = [], []
    for x, y, _, _, name in STALLS:
        for dx in (-85, 0, 85):
            circle(name, x + dx, y - 42, 64)
        for dx in (-48, 48):
            stalls.append(dict(id=f'{name}{dx}', prop=name, x=x + dx, y=y + 68))
    for x, y, name in BENCHES:
        for dx in (-62, 0, 62):
            circle(name, x + dx, y - 24, 33)
        for dx in (-53, 53):
            seats.append(dict(id=f'{name}{dx}', prop=name, x=x + dx, y=y - 48, approachY=y + 38))
    for x, y in LAMPS:
        circle('lamp', x, y, 22)
    for x in (132, 1468):
        circle('planter', x, 486, 54)
    data = dict(width=1600, height=1000, groundScale=1.65,
                floor=dict(x=800, y=610, rx=690, ry=375),
                fountain=dict(x=800, y=560), obstacles=obstacles,
                seats=seats, stalls=stalls,
                ring=[dict(id=f'ring{i}', x=800 + dx, y=560 + dy) for i, (dx, dy) in enumerate([
                    (-310, -22), (-235, -150), (-76, -188), (100, -188),
                    (250, -146), (315, 4), (244, 157), (82, 185), (-96, 185), (-254, 146)])])
    Path(__file__).with_name('web').joinpath('plaza-layout.json').write_text(json.dumps(data, indent=2) + '\n')
    return data


if __name__ == '__main__':
    export()
