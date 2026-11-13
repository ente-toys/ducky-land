import {DOMAdapter} from 'pixi.js';
import {transformOf} from './svg-context.js';

const paintDefaults = {
  fill: '#000',
  stroke: 'none',
  'fill-rule': 'nonzero',
  'fill-opacity': '1',
  'stroke-opacity': '1',
  'stroke-width': '1',
  'stroke-linecap': 'butt',
  'stroke-linejoin': 'miter',
  'stroke-miterlimit': '4',
};

function geometry(element) {
  if (element.localName === 'path') return new Path2D(element.getAttribute('d'));
  const path = new Path2D();
  const value = name => Number(element.getAttribute(name));
  if (element.localName === 'circle') path.arc(value('cx'), value('cy'), value('r'), 0, 2 * Math.PI);
  else if (element.localName === 'ellipse') path.ellipse(value('cx'), value('cy'), value('rx'), value('ry'), 0, 0, 2 * Math.PI);
  else if (element.localName === 'rect') path.rect(value('x'), value('y'), value('width'), value('height'));
  else throw Error(`Unsupported ground SVG shape: ${element.localName}`);
  return path;
}

function prepareNode(element, inherited, clips, patterns) {
  const paint = {...inherited};
  for (const name of Object.keys(paintDefaults)) {
    const value = element.getAttribute(name);
    if (value && value !== 'inherit') paint[name] = value;
  }
  const transform = element.hasAttribute('transform') ? transformOf(element.getAttribute('transform')) : null;
  const clipId = element.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1];
  const clip = clipId ? clips.get(clipId) : null;
  if (clipId && !clip) throw Error(`Missing ground SVG clip: ${clipId}`);
  const opacity = Number(element.getAttribute('opacity') ?? 1);

  let draw;
  if (element.localName === 'g' || element.localName === 'svg') {
    const children = Array.from(element.children).filter(child => !['defs', 'title', 'desc'].includes(child.localName))
      .map(child => prepareNode(child, paint, clips, patterns));
    draw = context => { for (const child of children) child(context); };
  } else {
    const path = geometry(element);
    const fillId = paint.fill.match(/^url\(#(.+)\)$/)?.[1];
    const pattern = fillId ? patterns.get(fillId) : null;
    if (fillId && !pattern) throw Error(`Missing ground SVG pattern: ${fillId}`);
    draw = context => {
      if (paint.fill !== 'none') {
        context.fillStyle = pattern ? pattern(context) : paint.fill;
        context.globalAlpha = opacity * Number(paint['fill-opacity']);
        context.fill(path, paint['fill-rule']);
      }
      if (paint.stroke !== 'none') {
        context.strokeStyle = paint.stroke;
        context.globalAlpha = opacity * Number(paint['stroke-opacity']);
        context.lineWidth = Number(paint['stroke-width']);
        context.lineCap = paint['stroke-linecap'];
        context.lineJoin = paint['stroke-linejoin'];
        context.miterLimit = Number(paint['stroke-miterlimit']);
        context.stroke(path);
      }
    };
  }

  if (!transform && !clip) return draw;
  return context => {
    context.save();
    if (transform) context.transform(transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty);
    if (clip) context.clip(clip.path, clip.rule);
    draw(context);
    context.restore();
  };
}

function preparePattern(element, clips, patterns) {
  if (element.getAttribute('patternUnits') !== 'userSpaceOnUse') throw Error('Ground SVG patterns need user space coordinates');
  const x = Number(element.getAttribute('x')), y = Number(element.getAttribute('y'));
  const width = Number(element.getAttribute('width')), height = Number(element.getAttribute('height'));
  const children = Array.from(element.children).map(child => prepareNode(child, paintDefaults, clips, patterns));
  let pattern;
  return context => {
    if (!pattern) {
      const density = 4;
      const canvas = DOMAdapter.get().createCanvas(Math.ceil(width * density), Math.ceil(height * density));
      const painter = canvas.getContext('2d');
      const scaleX = canvas.width / width, scaleY = canvas.height / height;
      painter.scale(scaleX, scaleY);
      for (const child of children) child(painter);
      pattern = context.createPattern(canvas, 'repeat');
      pattern.setTransform({a: 1 / scaleX, b: 0, c: 0, d: 1 / scaleY, e: x, f: y});
    }
    return pattern;
  };
}

export function prepareGroundSVG(text) {
  const root = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  if (root.localName !== 'svg') throw Error('Invalid ground SVG');
  const [x, y, width, height] = root.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
  const clips = new Map();
  for (const clip of root.querySelectorAll('defs > clipPath')) {
    const path = clip.firstElementChild;
    clips.set(clip.id, {path: geometry(path), rule: path.getAttribute('clip-rule') ?? 'nonzero'});
  }
  const patterns = new Map();
  for (const pattern of root.querySelectorAll('defs > pattern')) {
    patterns.set(pattern.id, preparePattern(pattern, clips, patterns));
  }
  return {x, y, width, height, draw: prepareNode(root, paintDefaults, clips, patterns)};
}

export function rasterizeGroundTile(ground, [, , x, y, width, height], resolution, clipToViewBox = false) {
  const canvas = DOMAdapter.get().createCanvas(Math.ceil(width * resolution), Math.ceil(height * resolution));
  const context = canvas.getContext('2d');
  context.setTransform(resolution, 0, 0, resolution, -x * resolution, -y * resolution);
  if (clipToViewBox) {
    context.beginPath();
    context.rect(ground.x, ground.y, ground.width, ground.height);
    context.clip();
  }
  ground.draw(context);
  return canvas;
}
