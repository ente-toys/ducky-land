# The growth field: how far each coast point moves (world units). Land is added on the north, west, north-east and the
# south-east; nothing moves round the north harbor (jetty foot 1726,830, tip 1640,400 and its nine berths), the south and
# south-west jetties, the islets, the east jetty or the east beach.
AN, AW, AE, AS = 360, 430, 200, 260
def ss(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)
def window(v, a, b, c, d):   # 0 below a, rises to 1 at b, holds to c, falls to 0 at d
    return ss((v - a) / (b - a)) * ss((d - v) / (d - c))
def D(x, y):
    harbor = ss((abs(x - 1690) - 520) / 520)
    dy = -AN * ss((1650 - y) / 850) * harbor
    dy += AS * ss((y - 2950) / 400) * window(x, 3640, 4050, 4250, 4700)
    dx = -AW * ss((1700 - x) / 1000) * ss((3250 - y) / 650) + AE * ss((x - 4300) / 900) * ss((1450 - y) / 750)
    return dx, dy
