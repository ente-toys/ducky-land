// A single astronaut in the same world as the stars, not a screen-fixed overlay.
// Local orbit coordinates are rotated once into the arrival's viewing direction.
export const SPACE_DUCKY_WIDTH=2679.98;
export const SPACE_DUCKY_HEIGHT=2804.81;
export function astronautAt(elapsed,anchor,reduced=false){
  const t=reduced?0:elapsed/1000;
  const phase=anchor.phase??0;
  const lx=(anchor.offsetX??180)+Math.sin(t*.25+phase)*12;
  const ly=(anchor.offsetY??110)+Math.sin(t*.31+phase)*9;
  const lz=(anchor.distance??520)+Math.cos(t*.21+phase)*14;
  const sy=Math.sin(anchor.yaw),cy=Math.cos(anchor.yaw),sp=Math.sin(anchor.pitch),cp=Math.cos(anchor.pitch),z0=-sp*ly+cp*lz;
  return {x:cy*lx+sy*z0,y:cp*ly+sp*lz,z:-sy*lx+cy*z0,roll:Math.sin(t*.16+phase)*5-3};
}

// Keep Figma's exact paths; only mark the two eye paths for CSS transforms.
export function blinkingAstronaut(svg){
  for(const id of ['Vector_51','Vector_52']){
    if(!svg.includes(`id="${id}"`))throw new Error(`Astronaut SVG missing eye ${id}`);
    svg=svg.replace(`id="${id}"`,`id="${id}" class="pixi-space-ducky-eye"`);
  }
  return svg;
}
