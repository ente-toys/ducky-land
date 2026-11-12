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
  if (element.localName !== 'circle') throw Error(`Unsupported Home ground shape: ${element.localName}`);
  const path = new Path2D();
  path.arc(Number(element.getAttribute('cx')), Number(element.getAttribute('cy')),
    Number(element.getAttribute('r')), 0, 2 * Math.PI);
  return path;
}

function prepareNode(element, inherited, clips) {
  const paint = {...inherited};
  for (const name of Object.keys(paintDefaults)) {
    const value = element.getAttribute(name);
    if (value && value !== 'inherit') paint[name] = value;
  }
  const transform = element.hasAttribute('transform') ? transformOf(element.getAttribute('transform')) : null;
  const clipId = element.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1];
  const clip = clipId ? clips.get(clipId) : null;
  if (clipId && !clip) throw Error(`Missing Home ground clip: ${clipId}`);
  const opacity = Number(element.getAttribute('opacity') ?? 1);

  let draw;
  if (element.localName === 'g' || element.localName === 'svg') {
    const children = Array.from(element.children).filter(child => child.localName !== 'defs')
      .map(child => prepareNode(child, paint, clips));
    draw = context => { for (const child of children) child(context); };
  } else {
    const path = geometry(element);
    draw = context => {
      if (paint.fill !== 'none') {
        context.fillStyle = paint.fill;
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

export function prepareHomeGround(text) {
  const root = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  if (root.localName !== 'svg') throw Error('Invalid Home ground SVG');
  const [x, y, width, height] = root.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
  const clips = new Map();
  for (const clip of root.querySelectorAll('defs > clipPath')) {
    const path = clip.firstElementChild;
    clips.set(clip.id, {path: geometry(path), rule: path.getAttribute('clip-rule') ?? 'nonzero'});
  }
  return {x, y, width, height, draw: prepareNode(root, paintDefaults, clips)};
}

export function rasterizeHomeGround(ground, [, , x, y, width, height], resolution) {
  const canvas = DOMAdapter.get().createCanvas(Math.ceil(width * resolution), Math.ceil(height * resolution));
  const context = canvas.getContext('2d');
  // Preserve the SVG viewport at the outer edges, including tiles with a gutter.
  context.setTransform(resolution, 0, 0, resolution, -x * resolution, -y * resolution);
  context.beginPath();
  context.rect(0, 0, ground.width, ground.height);
  context.clip();
  context.translate(-ground.x, -ground.y);
  ground.draw(context);
  return canvas;
}
