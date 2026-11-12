// Capture both retained mesh geometry and the remaining Graphics primitives.
export function fountainDrawing(root) {
  const visit = node => ({
    x: node.x, y: node.y, scale: [node.scale.x, node.scale.y], alpha: node.alpha, tint: node.tint,
    paths: node.context?.instructions.map(({action, data}) =>
      ({action, style: {...data.style, texture: undefined}, path: data.path.instructions})),
    positions: node.geometry ? Array.from(node.geometry.getBuffer('aPosition').data) : undefined,
    children: node.children.map(visit),
  });
  return JSON.stringify(visit(root));
}
