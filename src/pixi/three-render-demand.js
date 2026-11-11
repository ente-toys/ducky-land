// Camera movement renders at display cadence. An unchanged globe only renders
// after a resize or a live-texture update; its hearts have an independent overlay.
export class RenderDemand {
  dirty=true;
  invalidate(){this.dirty=true;}
  consume(moving=false){const draw=this.dirty||moving;this.dirty=false;return draw;}
}

// Water, clouds and ships share an ambient clock. Independent timers otherwise
// interleave redraws of the entire static globe between each other's updates.
export class AmbientDrawClock {
  pending=false;last=-Infinity;
  update(now,changed){
    this.pending ||= Boolean(changed);
    if(!this.pending||now-this.last<1000/30-.5)return false;
    this.pending=false;this.last=now;return true;
  }
}
