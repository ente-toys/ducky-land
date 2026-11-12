import test from 'node:test';
import assert from 'node:assert/strict';
import {Container, Graphics, Matrix} from 'pixi.js';
import {withRigidVisitors} from '../src/rendering/shared/rigid-visitors.js';
import {flatRigid, placeRigid} from '../src/world/rigid.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import {cameraMatrix} from '../src/rendering/shared/sphere-camera.js';
import {mapOf} from '../src/world/island-maps.js';

const matrix = o => {o.updateLocalTransform(); return o.localTransform.clone();};
const equalMatrix = (a, b) => {
  for (const key of ['a','b','c','d','tx','ty']) assert.ok(Math.abs(a[key]-b[key])<1e-6, `${key}: ${a[key]} != ${b[key]}`);
};
const state = o => [o.x,o.y,o.rotation,o.zIndex,o.visible,o.scale.x,o.scale.y,o.skew.x,o.skew.y,o.pivot.x,o.pivot.y];
const actor = (x, y) => {
  const o = new Container();
  o.position.set(x,y);o.pivot.set(12,47);o.scale.set(-.7,1.3);o.skew.set(.04,-.06);o.rotation=.027;o.zIndex=y+14;o.visible=false;
  return o;
};

test('boats and riders keep their exact screen transform through all 81 island copy frames', () => {
  for (const from of WORLD_ISLANDS) for (const to of WORLD_ISLANDS) {
    const m=mapOf(to.id),pin=placeRigid(from.id,to.id,{x:m.cx+450,y:m.cy+300});
    const boat=actor(pin.x,pin.y),rider=actor(pin.x+8,pin.y-22),front=actor(pin.x,pin.y);
    for(const o of [boat,rider,front]) {
      const original=matrix(o),saved=state(o),r=flatRigid(from.id,to.id);
      const copy=new Matrix(r.a,r.b,r.c,r.d,r.x-r.a*r.cx-r.c*r.cy,r.y-r.b*r.cx-r.d*r.cy);
      withRigidVisitors(from.id,to.id,[o],()=>{
        const composite=copy.clone().append(matrix(o));
        for(const zoom of [.15,.7,1.8])for(const tilt of [.65,1]) {
          const camera={x:pin.x,y:pin.y,zoom,basis:{a:.8,b:.6,c:-.6,d:.8}};
          const c=Object.assign(new Matrix(),cameraMatrix(camera,1440,900,tilt));
          equalMatrix(c.clone().append(composite),c.clone().append(original));
        }
        assert.equal(o.visible,true);
        assert.ok(Math.abs((o.zIndex-o.y)-(saved[3]-saved[1]))<1e-8,'depth offset preserved');
      });
      assert.deepEqual(state(o),saved,'rendering cannot mutate gameplay state');
      equalMatrix(matrix(o),original);
      o.destroy();
    }
  }
});

test('sibling hull masks follow the same frame and every transform restores after a failed render', () => {
  const objects=new Container(),o=actor(12000,4000),mask=new Graphics().rect(0,0,100,100).fill(0xffffff);
  objects.addChild(o,mask);o.mask=mask;mask.position.set(12000,4000);mask.rotation=.04;
  const before=state(o),maskBefore=state(mask),original=matrix(mask),r=flatRigid('home','isle-249');
  assert.throws(()=>withRigidVisitors('home','isle-249',[o],()=>{
    const copy=new Matrix(r.a,r.b,r.c,r.d,r.x-r.a*r.cx-r.c*r.cy,r.y-r.b*r.cx-r.d*r.cy);
    equalMatrix(copy.append(matrix(mask)),original);
    throw Error('render failed');
  }),/render failed/);
  assert.deepEqual(state(o),before);assert.deepEqual(state(mask),maskBefore);
  objects.destroy({children:true});
});

test('child masks inherit the visitor correction once', () => {
  const o=actor(12000,4000),mask=new Graphics().rect(0,0,100,100).fill(0xffffff);
  o.addChild(mask);o.mask=mask;mask.position.set(4,7);
  const before=state(mask);
  withRigidVisitors('home','isle-249',[o],()=>assert.deepEqual(state(mask),before));
  o.destroy({children:true});
});
