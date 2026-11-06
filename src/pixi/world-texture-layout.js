// Only construct wrapping copies that can reach the render texture. Most islands need
// one copy; islands crossing a seam need two (or four at a corner), rather than nine.
export function visibleWrapOffsets(x, y, halfWidth, halfHeight, width, height) {
  const offsets = [];
  for (const ox of [-width, 0, width]) for (const oy of [-height, 0, height]) {
    if (x + ox + halfWidth < 0 || x + ox - halfWidth > width ||
        y + oy + halfHeight < 0 || y + oy - halfHeight > height) continue;
    offsets.push([ox, oy]);
  }
  return offsets;
}
