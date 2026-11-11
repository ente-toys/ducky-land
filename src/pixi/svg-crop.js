// Preserve the complete original SVG, including its root viewBox and styles.
// Only the outer viewport changes. No geometry, colours or placements change.
export function cropSVG(original, crop, density = 1) {
  const [width,height,x,y,w,h]=crop;
  const clean=original.replace(/<\?xml[^>]*>/g,'').replace(/<!DOCTYPE[^>]*>/g,'');
  const start=clean.indexOf('<svg'),end=clean.indexOf('>',start),root=clean.slice(start,end+1);
  const viewBox=root.match(/viewBox\s*=\s*["']([^"']+)["']/)?.[1]??`0 0 ${width} ${height}`;
  const attrs=root.replace(/^<svg/,'').replace(/>$/,'')
    .replace(/\s(?:width|height|viewBox|preserveAspectRatio|x|y)\s*=\s*(["']).*?\1/g,'');
  // Give the decoder physical pixel dimensions too. Drawing a small intrinsic
  // SVG image into a larger canvas must never depend on browser-specific SVG
  // decode caching to retain its vector edges.
  const pixelsW=density===1?w:Math.ceil(w*density),pixelsH=density===1?h:Math.ceil(h*density);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelsW}" height="${pixelsH}" viewBox="${x} ${y} ${w} ${h}"><svg ${attrs} width="${width}" height="${height}" preserveAspectRatio="none" viewBox="${viewBox}">${clean.slice(end+1,clean.lastIndexOf('</svg>'))}</svg></svg>`;
}
