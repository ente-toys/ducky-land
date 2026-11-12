export class RenderDemand {
  dirty=true;
  invalidate(){this.dirty=true;}
  consume(moving=false){const draw=this.dirty||moving;this.dirty=false;return draw;}
}

export class AmbientDrawClock {
  pending=false;last=-Infinity;
  update(now,changed){
    this.pending ||= Boolean(changed);
    if(!this.pending||now-this.last<1000/30-.5)return false;
    this.pending=false;this.last=now;return true;
  }
}
