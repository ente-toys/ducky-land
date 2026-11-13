import {Matrix} from 'pixi.js';

const scratch=new Matrix();
// Apply the inverse world turn around the sprite's own pin. Conjugating by
// tilt also preserves the normal boat/rider shape with the optional tilt view.
export function sailingUpright(sprite,basis,tilt=1){
 if(!basis)return;
 sprite.updateLocalTransform();
 const m=sprite.localTransform,det=basis.a*basis.d-basis.b*basis.c;
 const a=basis.d/det,b=-basis.b/det/tilt,c=-basis.c/det*tilt,d=basis.a/det;
 scratch.set(a*m.a+c*m.b,b*m.a+d*m.b,a*m.c+c*m.d,b*m.c+d*m.d,m.tx,m.ty);
 sprite.setFromMatrix(scratch);
}
