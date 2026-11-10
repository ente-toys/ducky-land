// Camera movement renders at display cadence. An unchanged globe only renders
// after a resize or a live-texture update; its hearts have an independent overlay.
export class RenderDemand {
  dirty=true;
  invalidate(){this.dirty=true;}
  consume(moving=false){const draw=this.dirty||moving;this.dirty=false;return draw;}
}
