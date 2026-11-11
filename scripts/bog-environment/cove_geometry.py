"""Round only Lantern Cove's two acute noses, preserving the sailing channel."""
from shapely.geometry import Polygon, box


def round_cove(coast, inlet):
    dry = Polygon(coast).difference(inlet)
    # Rolling radii trim the blades back into broad, asymmetric headlands.
    # The smaller eastern nose preserves the existing bank-side tree root.
    # Restrict both trims to the mouth, away from the jetty and bridge.
    shore = dry
    for radius, bounds in [(130, (3400, 7580, 4200, 8200)),
                           (90, (4550, 7580, 5050, 8200))]:
        rounded = dry.buffer(-radius, quad_segs=24).buffer(radius, quad_segs=24)
        trim = dry.difference(rounded).intersection(box(*bounds))
        shore = shore.difference(trim)
    # Discard zero-area boundary segments left by the polygon difference.
    shore = shore.buffer(0)
    assert shore.geom_type == 'Polygon' and shore.is_valid
    return [[round(x, 2), round(y, 2)] for x, y in shore.exterior.coords[:-1]]
