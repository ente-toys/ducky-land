const INK = '#332b23';
const PAPER = '#fff9ed';
const FONT_URL = '/guest/fredoka-700.woff2';
let fontReady;

// The caption is drawn into the photo itself, so the brand travels with every save and share.
function loadCaptionFont(document) {
  if (!fontReady) {
    const face = typeof FontFace === 'function' ? new FontFace('Fredoka', `url(${FONT_URL})`, {weight:'700'}) : null;
    fontReady = face
      ? face.load().then(loaded => {document.fonts?.add(loaded); return true;}).catch(() => false)
      : Promise.resolve(false);
  }
  return Promise.race([fontReady, new Promise(resolve => setTimeout(() => resolve(false), 600))])
    .then(ok => ok || document.fonts?.check?.('700 12px Fredoka'));
}

function fitText(context, text, size, maxWidth, family) {
  let px = size;
  context.font = `700 ${px}px ${family}`;
  while (px > 8 && context.measureText(text).width > maxWidth) {
    px -= 1;
    context.font = `700 ${px}px ${family}`;
  }
  return px;
}

// One line under the photo: the player on the left, the site on the right, sharing a baseline.
function drawCaption(context, x, y, width, height, family, player) {
  const site = 'world.ente.com';
  const nameSize = Math.round(height * 0.4);
  const baseline = Math.round(y + height / 2 + nameSize * 0.36);
  context.textBaseline = 'alphabetic';

  context.textAlign = 'right';
  context.fillStyle = '#8a7a66';
  fitText(context, site, Math.round(height * 0.3), width * 0.45, family);
  context.fillText(site, x + width, baseline);

  if (!player) return;
  context.textAlign = 'left';
  context.fillStyle = INK;
  fitText(context, `@${player}`, nameSize, width * 0.5, family);
  context.fillText(`@${player}`, x, baseline);
}

function drawNameplates(context, viewport, nameLayer, border, width, height) {
  const window = viewport.ownerDocument.defaultView;
  const layerStyle = window.getComputedStyle(nameLayer);
  const opacity = Number(layerStyle.opacity);
  if (!opacity || layerStyle.visibility !== 'visible') return;

  const frame = viewport.getBoundingClientRect();
  context.save();
  context.beginPath();
  context.rect(border, border, width, height);
  context.clip();
  context.translate(border, border);
  context.scale(width / frame.width, height / frame.height);
  context.globalAlpha = opacity;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  for (const label of nameLayer.children) {
    if (label.hidden) continue;
    const box = label.getBoundingClientRect();
    if (!box.width || !box.height || box.right <= frame.left || box.left >= frame.right ||
        box.bottom <= frame.top || box.top >= frame.bottom) continue;

    const style = window.getComputedStyle(label);
    const x = box.left - frame.left;
    const y = box.top - frame.top;
    const stroke = parseFloat(style.borderTopWidth);
    context.beginPath();
    context.roundRect(x + stroke / 2, y + stroke / 2, box.width - stroke, box.height - stroke,
      Math.max(0, parseFloat(style.borderTopLeftRadius) - stroke / 2));
    context.fillStyle = style.backgroundColor;
    context.fill();
    if (stroke > 0) {
      context.lineWidth = stroke;
      context.strokeStyle = style.borderTopColor;
      context.stroke();
    }
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.fillStyle = style.color;
    context.fillText(label.textContent, x + box.width / 2, y + box.height / 2);
  }

  context.restore();
}

export function renderPolaroid(viewport, layers, background, {player = '', nameLayer} = {}) {
  const [source] = layers;
  const {clientWidth, clientHeight} = viewport;
  if (!clientWidth || !clientHeight || !source.width || !source.height) {
    throw new Error('The photo has no usable frame.');
  }

  const scale = Math.min(source.width / clientWidth, source.height / clientHeight,
    2048 / Math.max(clientWidth, clientHeight));
  const width = Math.max(1, Math.round(clientWidth * scale));
  const height = Math.max(1, Math.round(clientHeight * scale));
  const border = Math.max(1, Math.round(Math.min(width, height) * 0.05));
  const caption = 3 * border;
  const photo = viewport.ownerDocument.createElement('canvas');
  photo.width = width + 2 * border;
  photo.height = height + 2 * border + caption;

  const context = photo.getContext('2d');
  context.fillStyle = PAPER;
  context.fillRect(0, 0, photo.width, photo.height);
  context.fillStyle = background;
  context.fillRect(border, border, width, height);
  // Draw the scene now: the WebGL canvas is only readable inside this frame.
  for (const layer of layers) {
    context.drawImage(layer, border, border, width, height);
  }
  if (nameLayer?.children.length) drawNameplates(context, viewport, nameLayer, border, width, height);

  const document = viewport.ownerDocument;
  return loadCaptionFont(document).then(hasFont => {
    const family = hasFont ? "'Fredoka', system-ui, sans-serif" : 'system-ui, sans-serif';
    drawCaption(context, border, border + height, width, caption, family, player);
    return new Promise((resolve, reject) => {
      photo.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode the photo.'));
      }, 'image/png');
    });
  });
}
