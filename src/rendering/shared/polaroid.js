export function renderPolaroid(viewport, layers, background) {
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
  const photo = viewport.ownerDocument.createElement('canvas');
  photo.width = width + 2 * border;
  photo.height = height + 4 * border;

  const context = photo.getContext('2d');
  context.fillStyle = '#fff9ed';
  context.fillRect(0, 0, photo.width, photo.height);
  context.fillStyle = background;
  context.fillRect(border, border, width, height);
  for (const layer of layers) {
    context.drawImage(layer, border, border, width, height);
  }

  return new Promise((resolve, reject) => {
    photo.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the photo.'));
    }, 'image/png');
  });
}
